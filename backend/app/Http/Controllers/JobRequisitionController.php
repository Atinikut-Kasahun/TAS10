<?php

namespace App\Http\Controllers;

use App\Models\JobRequisition;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class JobRequisitionController extends Controller
{
    /**
     * Display a listing of requisitions for the user's tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = JobRequisition::with(['requester', 'approvedBy', 'tenant', 'jobPosting']);

        // Tenant Isolation (except Global Admin and HR Manager)
        if (!$user->hasRole('admin') && !$user->hasRole('hr_manager')) {
            $query->where('tenant_id', $user->tenant_id);
        } elseif ($request->has('tenant_id') && !empty($request->tenant_id)) {
            // Allow Global Admin or HR Manager to filter by a specific tenant
            $query->where('tenant_id', $request->tenant_id);
        }

        // Role-based filtering:
        // 1. Hiring managers only see their own requests
        if ($user->hasRole('hiring_manager') && !$user->hasRole('hr_manager') && !$user->hasRole('admin')) {
            $query->where('requested_by', $user->id);
        }

        // 2. TA managers see all approved requisitions in their tenant
        if ($user->hasRole('ta_manager') && !$user->hasRole('admin') && !$user->hasRole('hr_manager')) {
            $query->where('status', 'approved');
        }

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'LIKE', "%{$search}%")
                    ->orWhere('department', 'LIKE', "%{$search}%")
                    ->orWhere('priority', 'LIKE', "%{$search}%");
            });
        }

        // Calculate KPIs using query clones for database-level counting
        $kpis = [
            'open_requests' => (clone $query)->where('status', 'pending')->count(),
            'approved_this_quarter' => (clone $query)->where('status', 'approved')
                ->where('approved_at', '>=', now()->startOfQuarter())->count(),
            'team_growth' => (clone $query)->where('status', 'approved')->sum('headcount'),
            'awaiting_approval' => (clone $query)->where('status', 'pending')->count(),
            'avg_approval_time_hours' => round((clone $query)->where('status', 'approved')
                ->whereNotNull('approved_at')
                ->get()
                ->avg(function ($r) {
                    return $r->created_at->diffInHours($r->approved_at);
                }) ?? 0, 1),
        ];

        $requisitions = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'data' => $requisitions,
            'kpis' => $kpis
        ]);
    }

    /**
     * Store a newly created requisition.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'department' => 'required|string|max:255',
            'location' => 'required|string|max:255',
            'description' => 'nullable|string',
            'headcount' => 'required|integer|min:1',
            'priority' => 'required|in:low,medium,high,urgent',
            'jd_file' => 'nullable|file|mimes:pdf,doc,docx|max:5120', // New validation
        ]);

        $user = $request->user();
        $tenantId = $user->tenant_id;

        if (!$tenantId) {
            return response()->json(['error' => 'No active company context found.'], 400);
        }

        $jdPath = null;
        if ($request->hasFile('jd_file')) {
            $file = $request->file('jd_file');
            $filename = time() . '_' . $file->getClientOriginalName();
            $jdPath = $file->storeAs('jds', $filename, 'public');
        }

        $requisition = JobRequisition::create([
            'tenant_id' => $tenantId,
            'requested_by' => $user->id,
            'title' => $request->title,
            'description' => $request->description,
            'department' => $request->department,
            'location' => $request->location,
            'headcount' => $request->headcount ?? 1,
            'budget' => $request->budget,
            'position_type' => $request->position_type ?? 'new',
            'priority' => $request->priority ?? 'medium',
            'status' => 'pending',
            'jd_path' => $jdPath,
        ]);

        // Notify HR Managers
        $hrManagers = \App\Models\User::where('tenant_id', $tenantId)
            ->whereHas('roles', function ($q) {
                $q->where('slug', 'hr_manager');
            })->get();

        foreach ($hrManagers as $hrManager) {
            $hrManager->notify(new \App\Notifications\RequisitionApprovalAlert($requisition));
        }

        return response()->json($requisition, 201);
    }

    public function duplicate(string $id, Request $request): JsonResponse
    {
        $original = JobRequisition::findOrFail($id);

        // Security Check
        if (!$request->user()->hasRole('admin') && $original->tenant_id !== $request->user()->tenant_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $new = $original->replicate(['status', 'rejection_reason', 'approved_at', 'approved_by']);
        $new->requested_by = $request->user()->id;
        $new->status = 'pending';
        $new->save();

        return response()->json($new, 201);
    }

    /**
     * Bulk approve multiple requisitions (HR Manager only).
     */
    public function bulkApprove(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->hasRole('hr_manager') && !$user->hasRole('admin')) {
            return response()->json(['error' => 'Only HR Managers can bulk approve requisitions.'], 403);
        }

        $request->validate(['ids' => 'required|array', 'ids.*' => 'integer']);

        $query = JobRequisition::whereIn('id', $request->ids)
            ->where('status', 'pending');

        if (!$user->hasRole('admin') && !$user->hasRole('hr_manager')) {
            $query->where('tenant_id', $user->tenant_id);
        }

        $updated = $query->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => $user->id,
        ]);

        return response()->json(['approved_count' => $updated]);
    }

    /**
     * Approve or reject a requisition (TA Manager Role).
     */
    public function updateStatus(string $id, Request $request): JsonResponse
    {
        $user = $request->user();
        $request->validate([
            'status' => 'required|in:approved,rejected',
            'rejection_reason' => 'required_if:status,rejected|string',
        ]);

        $requisition = JobRequisition::findOrFail($id);

        // Security Check
        if (!$user->hasRole('admin') && $requisition->tenant_id !== $user->tenant_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Only HR Managers (or Admins) can approve/reject
        if (!$user->hasRole('hr_manager') && !$user->hasRole('admin')) {
            return response()->json(['error' => 'Only HR Managers can authorize requisitions.'], 403);
        }

        $requisition->update([
            'status' => $request->status,
            'rejection_reason' => $request->rejection_reason,
            'approved_at' => $request->status === 'approved' ? now() : null,
            'approved_by' => $request->status === 'approved' ? $user->id : null,
        ]);

        return response()->json($requisition);
    }

    /**
     * Securely serve the JD document.
     */
    public function downloadJd(string $id, Request $request)
    {
        $requisition = JobRequisition::findOrFail($id);

        // Security Check: Ensure user belongs to the same tenant or is global admin
        $user = $request->user();

        if ($user && !$user->hasRole('admin') && $requisition->tenant_id !== $user->tenant_id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!$requisition->jd_path) {
            return response()->json(['error' => 'No JD document attached to this requisition.'], 404);
        }

        // Use Laravel Storage facade for reliable cross-platform path resolution
        $disk = \Illuminate\Support\Facades\Storage::disk('public');

        if (!$disk->exists($requisition->jd_path)) {
            return response()->json([
                'error' => 'File not found on server.',
                'path' => $requisition->jd_path,
            ], 404);
        }

        $fullPath = $disk->path($requisition->jd_path);
        $extension = strtolower(pathinfo($requisition->jd_path, PATHINFO_EXTENSION));
        $originalName = basename($requisition->jd_path);

        // Determine MIME type and disposition
        $mimeMap = [
            'pdf' => 'application/pdf',
            'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        $contentType = $mimeMap[$extension] ?? 'application/octet-stream';

        // PDFs open inline in the browser; Word docs must be downloaded
        $disposition = ($extension === 'pdf') ? 'inline' : 'attachment';

        // Clean filename for the Content-Disposition header (remove non-ASCII chars)
        $safeFilename = 'JD_REQ' . $requisition->id . '.' . $extension;

        return response()->file($fullPath, [
            'Content-Type' => $contentType,
            'Content-Disposition' => $disposition . '; filename="' . $safeFilename . '"',
        ]);
    }
}
