<?php

namespace App\Http\Controllers;

use App\Models\Applicant;
use App\Models\JobPosting;
use App\Models\JobRequisition;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Models\Event;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasRole('admin')) {
            return $this->adminDashboard();
        }

        if ($user->hasRole('ta_manager')) {
            return $this->taManagerDashboard($user->tenant_id);
        }

        return $this->hiringManagerDashboard($user);
    }

    private function adminDashboard(): JsonResponse
    {
        $stats = Cache::remember('admin_dashboard_stats', now()->addMinutes(10), function () {
            $today = \Carbon\Carbon::today();
            $yesterday = \Carbon\Carbon::yesterday();
            $thirtyDaysAgo = now()->subDays(30);

            // Core Counts
            $activeJobsCount = \App\Models\JobPosting::where('status', 'active')->count();
            $candidatesCount = \App\Models\Applicant::count();
            $employeesCount = \App\Models\User::count();
            $newTodayCount = \App\Models\Applicant::whereDate('created_at', $today)->count();
            $activeEventsCount = \App\Models\Event::where('event_date', '>=', now())->count();

            // Trend Calculations
            $jobsPastCount = \App\Models\JobPosting::where('status', 'active')->where('created_at', '<', $thirtyDaysAgo)->count();
            $jobsTrend = $jobsPastCount > 0 ? round((($activeJobsCount - $jobsPastCount) / $jobsPastCount) * 100, 1) : ($activeJobsCount > 0 ? 100 : 0);

            $candidatesPastCount = \App\Models\Applicant::where('created_at', '<', $thirtyDaysAgo)->count();
            $candidatesTrend = $candidatesPastCount > 0 ? round((($candidatesCount - $candidatesPastCount) / $candidatesPastCount) * 100, 1) : ($candidatesCount > 0 ? 100 : 0);

            $newYesterdayCount = \App\Models\Applicant::whereDate('created_at', $yesterday)->count();
            $newTodayTrend = $newYesterdayCount > 0 ? round((($newTodayCount - $newYesterdayCount) / $newYesterdayCount) * 100, 1) : ($newTodayCount > 0 ? 100 : 0);

            $eventsPastCount = \App\Models\Event::where('event_date', '>=', now()->subDays(7))->where('created_at', '<', now()->subDays(7))->count();
            $eventsTrend = $eventsPastCount > 0 ? round((($activeEventsCount - $eventsPastCount) / $eventsPastCount) * 100, 1) : ($activeEventsCount > 0 ? 100 : 0);

            return [
                'total_tenants' => \App\Models\Tenant::count(),
                'total_active_jobs' => $activeJobsCount,
                'total_active_jobs_trend' => $jobsTrend,
                'total_active_jobs_label' => 'vs last month',
                'total_candidates' => $candidatesCount,
                'total_candidates_trend' => $candidatesTrend,
                'total_candidates_label' => 'vs last month',
                'total_employees' => $employeesCount,
                'new_applications_today' => $newTodayCount,
                'new_applications_today_trend' => $newTodayTrend,
                'new_applications_today_label' => 'vs yesterday',
                'active_events' => $activeEventsCount,
                'active_events_trend' => $eventsTrend,
                'active_events_label' => 'vs last week',
                'tenants_breakdown' => \App\Models\Tenant::withCount([
                    'jobPostings as active_jobs_count' => function ($query) {
                        $query->where('status', 'active');
                    },
                    'jobPostings',
                    'jobRequisitions',
                    'users',
                    'applicants',
                    'applicants as hired_count' => function ($query) {
                        $query->where('status', 'hired');
                    }
                ])->get()->map(function ($tenant) {
                    $tenant->conversion_rate = $tenant->applicants_count > 0
                        ? round(($tenant->hired_count / $tenant->applicants_count) * 100, 1)
                        : 0;
                    return $tenant;
                }),
                'recent_global_applicants' => \App\Models\Applicant::with('tenant', 'jobPosting')
                    ->orderBy('created_at', 'desc')
                    ->limit(5)
                    ->get(),
            ];
        });

        return response()->json($stats);
    }

    private function taManagerDashboard($tenantId): JsonResponse
    {
        $stats = Cache::remember("ta_manager_dashboard_stats_{$tenantId}", now()->addMinutes(10), function () use ($tenantId) {
            $today = Carbon::today();
            $yesterday = Carbon::yesterday();
            $thirtyDaysAgo = now()->subDays(30);

            // Core Counts
            $activeJobsCount = JobPosting::where('tenant_id', $tenantId)->where('status', 'active')->count();
            $candidatesCount = \App\Models\Applicant::where('tenant_id', $tenantId)->count();
            $employeesCount = \App\Models\User::where('tenant_id', $tenantId)->count();
            $newTodayCount = \App\Models\Applicant::where('tenant_id', $tenantId)->whereDate('created_at', $today)->count();
            $activeEventsCount = Event::where('tenant_id', $tenantId)->where('event_date', '>=', now())->count();

            // Trend Calculations
            $jobsPastCount = JobPosting::where('tenant_id', $tenantId)->where('status', 'active')->where('created_at', '<', $thirtyDaysAgo)->count();
            $jobsTrend = $jobsPastCount > 0 ? round((($activeJobsCount - $jobsPastCount) / $jobsPastCount) * 100, 1) : ($activeJobsCount > 0 ? 100 : 0);

            $candidatesPastCount = \App\Models\Applicant::where('tenant_id', $tenantId)->where('created_at', '<', $thirtyDaysAgo)->count();
            $candidatesTrend = $candidatesPastCount > 0 ? round((($candidatesCount - $candidatesPastCount) / $candidatesPastCount) * 100, 1) : ($candidatesCount > 0 ? 100 : 0);

            $newYesterdayCount = \App\Models\Applicant::where('tenant_id', $tenantId)->whereDate('created_at', $yesterday)->count();
            $newTodayTrend = $newYesterdayCount > 0 ? round((($newTodayCount - $newYesterdayCount) / $newYesterdayCount) * 100, 1) : ($newTodayCount > 0 ? 100 : 0);

            $hiredApps = \App\Models\Applicant::where('tenant_id', $tenantId)->where('status', 'hired')->get();
            $avgTime = $hiredApps->count() > 0 ? round($hiredApps->map(function ($app) {
                return $app->created_at->diffInDays($app->updated_at);
            })->average()) : 0;

            $employeesPastCount = \App\Models\User::where('tenant_id', $tenantId)->where('created_at', '<', $thirtyDaysAgo)->count();
            $employeesTrend = $employeesPastCount > 0 ? round((($employeesCount - $employeesPastCount) / $employeesPastCount) * 100, 1) : ($employeesCount > 0 ? 100 : 0);

            $separationsCount = \App\Models\User::where('tenant_id', $tenantId)
                ->whereIn('employment_status', ['resigned', 'terminated'])
                ->where('separation_date', '>=', $thirtyDaysAgo)
                ->count();
            $retentionRate = $employeesCount > 0 ? round((($employeesCount - $separationsCount) / $employeesCount) * 100, 1) : 100;

            $sources = \App\Models\Applicant::where('tenant_id', $tenantId)
                ->select('source', DB::raw('count(*) as count'))
                ->groupBy('source')
                ->orderByDesc('count')
                ->get();

            $eventsPastCount = Event::where('tenant_id', $tenantId)->where('event_date', '>=', now()->subDays(30))->where('created_at', '<', now()->subDays(30))->count();
            $eventsTrend = $eventsPastCount > 0 ? round((($activeEventsCount - $eventsPastCount) / $eventsPastCount) * 100, 1) : ($activeEventsCount > 0 ? 100 : 0);

            return [
                'total_active_jobs' => $activeJobsCount,
                'total_active_jobs_trend' => $jobsTrend,
                'total_active_jobs_label' => 'vs last month',
                'total_candidates' => $candidatesCount,
                'total_candidates_trend' => $candidatesTrend,
                'total_candidates_label' => 'vs last month',
                'total_employees' => $employeesCount,
                'total_employees_trend' => $employeesTrend,
                'total_employees_label' => 'vs last month',
                'retention_rate' => $retentionRate,
                'new_applications_today' => $newTodayCount,
                'new_applications_today_trend' => $newTodayTrend,
                'new_applications_today_label' => 'vs yesterday',
                'active_events' => $activeEventsCount,
                'active_events_trend' => $eventsTrend,
                'active_events_label' => 'vs last month',
                'pending_requisitions' => JobRequisition::where('tenant_id', $tenantId)->where('status', 'pending')->count(),
                'recent_applicants' => \App\Models\Applicant::with('jobPosting')
                    ->where('tenant_id', $tenantId)
                    ->orderBy('created_at', 'desc')
                    ->limit(5)
                    ->get(),
                'funnel' => [
                    'applied' => \App\Models\Applicant::where('tenant_id', $tenantId)->count(),
                    'interview' => \App\Models\Applicant::where('tenant_id', $tenantId)->where('status', 'interview')->count(),
                    'offer' => \App\Models\Applicant::where('tenant_id', $tenantId)->where('status', 'offer')->count(),
                    'hired' => \App\Models\Applicant::where('tenant_id', $tenantId)->where('status', 'hired')->count(),
                    'rejected' => \App\Models\Applicant::where('tenant_id', $tenantId)->where('status', 'rejected')->count(),
                ],
                'requisitions' => [
                    'pending' => JobRequisition::where('tenant_id', $tenantId)->where('status', 'pending')->count(),
                ],
                'velocity' => [
                    'average_time_to_hire_days' => $avgTime,
                ],
                'sources' => $sources,
            ];
        });

        return response()->json($stats);
    }

    private function hiringManagerDashboard($user): JsonResponse
    {
        $stats = Cache::remember("hiring_manager_dashboard_stats_{$user->id}", now()->addMinutes(5), function () use ($user) {
            return [
                'my_requisitions' => JobRequisition::where('requested_by', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get(),
                'requisitions_status_count' => JobRequisition::where('requested_by', $user->id)
                    ->select('status', DB::raw('count(*) as count'))
                    ->groupBy('status')
                    ->get(),
            ];
        });

        return response()->json($stats);
    }

    /**
     * Global Admin: aggregated reports with Time-to-Hire per company.
     */
    public function reportsData(): JsonResponse
    {
        $avgDaysMap = \App\Models\Applicant::where('status', 'hired')
            ->whereNotNull('hired_at')
            ->selectRaw('tenant_id, AVG(DATEDIFF(hired_at, created_at)) as avg_days')
            ->groupBy('tenant_id')
            ->pluck('avg_days', 'tenant_id');

        $tenants = \App\Models\Tenant::withCount([
            'jobPostings as active_jobs_count' => function ($q) {
                $q->where('status', 'active');
            },
            'jobPostings as total_jobs_count',
            'applicants',
            'applicants as hired_count' => function ($q) {
                $q->where('status', 'hired');
            },
            'applicants as shortlisted_count' => function ($q) {
                $q->where('status', 'shortlisted');
            },
            'applicants as interview_count' => function ($q) {
                $q->where('status', 'interview');
            },
        ])->get()->map(function ($tenant) use ($avgDaysMap) {
            $avgDaysToHire = $avgDaysMap[$tenant->id] ?? null;

            $tenant->avg_days_to_hire = $avgDaysToHire ? round($avgDaysToHire, 1) : null;
            $tenant->conversion_rate = $tenant->applicants_count > 0
                ? round(($tenant->hired_count / $tenant->applicants_count) * 100, 1)
                : 0;

            return $tenant;
        })->sortByDesc('hired_count')->values();

        $globalStats = [
            'total_applied' => \App\Models\Applicant::count(),
            'total_shortlisted' => \App\Models\Applicant::where('status', 'shortlisted')->count(),
            'total_interview' => \App\Models\Applicant::where('status', 'interview')->count(),
            'total_hired' => \App\Models\Applicant::where('status', 'hired')->count(),
            'total_rejected' => \App\Models\Applicant::where('status', 'rejected')->count(),
        ];

        return response()->json([
            'tenants' => $tenants,
            'global_funnel' => $globalStats,
        ]);
    }
}
