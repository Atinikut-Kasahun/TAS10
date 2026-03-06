<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class EmployeeController extends Controller
{
    /**
     * List all users (employees) for the authenticated user's tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        if (!$tenantId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = User::with('roles')
            ->where('tenant_id', $tenantId);

        // Allow filtering by status
        if ($request->has('status') && $request->status !== 'All') {
            $query->where('employment_status', $request->status);
        }

        // Search
        if ($request->has('search') && !empty($request->search)) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                    ->orWhere('email', 'like', "%{$s}%");
            });
        }

        $perPage = $request->input('per_page', 20);
        $employees = $query->latest()->paginate($perPage);

        return response()->json($employees);
    }

    /**
     * Mark an employee as Resigned or Terminated.
     * Records the separation_date and separation_reason, then feeds turnover graph.
     */
    public function updateStatus(Request $request, $id): JsonResponse
    {
        $admin = $request->user();

        $employee = User::where('id', $id)
            ->where('tenant_id', $admin->tenant_id)
            ->firstOrFail();

        $validated = $request->validate([
            'employment_status' => 'required|in:active,resigned,terminated',
            'separation_date' => 'nullable|date',
            'separation_reason' => 'nullable|string|max:500',
            'joined_date' => 'nullable|date',
        ]);

        // When marking as separated, default separation_date to today
        if (in_array($validated['employment_status'], ['resigned', 'terminated'])) {
            $validated['separation_date'] = $validated['separation_date'] ?? now()->toDateString();
        } else {
            // Re-activating clears separation info
            $validated['separation_date'] = null;
            $validated['separation_reason'] = null;
        }

        $employee->update($validated);
        $employee->load('roles');

        // Bust the dashboard cache so turnover graph updates immediately
        \Illuminate\Support\Facades\Cache::forget("ta_manager_dashboard_stats_{$admin->tenant_id}");

        return response()->json([
            'message' => 'Employee status updated successfully',
            'employee' => $employee,
        ]);
    }

    /**
     * Monthly turnover rate for the last N months.
     *
     * Formula per month:
     *   separations_in_month / avg(headcount_start_of_month, headcount_end_of_month) * 100
     *
     * Returns: [{ label: 'Jan', rate: 4.2 }, ...]
     */
    public function turnoverData(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        if (!$tenantId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $months = (int) $request->input('months', 12);
        $months = max(3, min($months, 24));

        $result = [];

        for ($i = $months - 1; $i >= 0; $i--) {
            $monthStart = Carbon::now()->startOfMonth()->subMonths($i);
            $monthEnd = $monthStart->copy()->endOfMonth();

            // Headcount at start of month = joined before start AND (still active OR separated after month end)
            $headcountStart = User::where('tenant_id', $tenantId)
                ->where(function ($q) use ($monthStart) {
                    $q->whereNull('joined_date')
                        ->orWhere('joined_date', '<=', $monthStart);
                })
                ->where(function ($q) use ($monthStart) {
                    // Either still active, or separated after month start
                    $q->where('employment_status', 'active')
                        ->orWhere(function ($q2) use ($monthStart) {
                        $q2->whereIn('employment_status', ['resigned', 'terminated'])
                            ->where('separation_date', '>=', $monthStart);
                    });
                })
                ->count();

            // Headcount at end of month
            $headcountEnd = User::where('tenant_id', $tenantId)
                ->where(function ($q) use ($monthEnd) {
                    $q->whereNull('joined_date')
                        ->orWhere('joined_date', '<=', $monthEnd);
                })
                ->where(function ($q) use ($monthEnd) {
                    $q->where('employment_status', 'active')
                        ->orWhere(function ($q2) use ($monthEnd) {
                            $q2->whereIn('employment_status', ['resigned', 'terminated'])
                                ->where('separation_date', '>', $monthEnd);
                        });
                })
                ->count();

            // Separations that happened within this month
            $separations = User::where('tenant_id', $tenantId)
                ->whereIn('employment_status', ['resigned', 'terminated'])
                ->whereBetween('separation_date', [$monthStart, $monthEnd])
                ->count();

            $avgHeadcount = ($headcountStart + $headcountEnd) / 2;
            $rate = $avgHeadcount > 0
                ? round(($separations / $avgHeadcount) * 100, 1)
                : 0;

            $result[] = [
                'label' => $monthStart->format('M'),
                'year' => (int) $monthStart->format('Y'),
                'month' => (int) $monthStart->format('n'),
                'separations' => $separations,
                'headcount' => round($avgHeadcount),
                'rate' => $rate,
            ];
        }

        // Trend: compare last month rate to the month before
        $lastRate = count($result) >= 1 ? $result[count($result) - 1]['rate'] : 0;
        $prevRate = count($result) >= 2 ? $result[count($result) - 2]['rate'] : 0;
        $trendPct = $prevRate > 0
            ? round((($lastRate - $prevRate) / $prevRate) * 100, 1)
            : ($lastRate > 0 ? 100 : 0);

        return response()->json([
            'turnover' => $result,
            'trend' => $trendPct,
            'last_rate' => $lastRate,
        ]);
    }
}
