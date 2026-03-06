'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch, API_URL } from '@/lib/api';

export default function TADashboard({ user, activeTab: initialTab, onLogout }: { user: any; activeTab: string; onLogout: () => void }) {
    const [jobs, setJobs] = useState<any[] | null>(null);
    const [requisitions, setRequisitions] = useState<any[] | null>(null);
    const [applicants, setApplicants] = useState<any[] | null>(null);
    const [applicantsPagination, setApplicantsPagination] = useState<any>(null);
    const [jobsPagination, setJobsPagination] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [search, setSearch] = useState(''); // live search term from URL
    const [subTab, setSubTab] = useState('NEW'); // Represents the local view/stage
    const [drawerReq, setDrawerReq] = useState<any>(null);
    const [drawerApp, setDrawerApp] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const router = useRouter();
    const [offerModal, setOfferModal] = useState(false);
    const [offerForm, setOfferForm] = useState({ salary: '', startDate: '', notes: '' });
    const [rejectModal, setRejectModal] = useState(false);
    const [rejectionNote, setRejectionNote] = useState('');
    const [reportFilters, setReportFilters] = useState({ dateRange: '30', department: 'All', jobId: 'All' });
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [interviewsList, setInterviewsList] = useState<any[]>([]);

    // Interview Scheduling Modal State
    const [scheduleModal, setScheduleModal] = useState(false);
    const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', type: 'video', location: '', interviewer_id: '', message: '' });

    // Notifications & Mentions
    const [mentionUser, setMentionUser] = useState('');
    const [mentionNote, setMentionNote] = useState('');
    const [mentionLoading, setMentionLoading] = useState(false);
    const [mentionSuccess, setMentionSuccess] = useState(false);
    const [departmentUsers, setDepartmentUsers] = useState<any[]>([]);

    // Manual Candidate Add Modal
    const [addCandidateModal, setAddCandidateModal] = useState(false);
    const [candidateForm, setCandidateForm] = useState({ name: '', email: '', phone: '', source: 'LinkedIn', job_posting_id: '' });
    const [candidateSuccess, setCandidateSuccess] = useState(false);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
    const [employeeStatusModal, setEmployeeStatusModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [employeeStatusForm, setEmployeeStatusForm] = useState({ status: 'active', reason: '', date: '' });
    const [employees, setEmployees] = useState<any[] | null>(null);
    const [employeesPagination, setEmployeesPagination] = useState<any>(null);

    useEffect(() => {
        if (drawerApp) {
            apiFetch('/v1/users').then(data => setDepartmentUsers(data || []));
        }
    }, [drawerApp]);

    const searchParams = useSearchParams();
    const liveSearch = searchParams.get('search') ?? '';

    // Sync local search state with URL search param
    useEffect(() => {
        setSearch(liveSearch);
    }, [liveSearch]);

    const handleSendMention = async () => {
        if (!mentionUser || !mentionNote.trim()) return;
        setMentionLoading(true);
        setMentionSuccess(false);
        try {
            await apiFetch(`/v1/applicants/${drawerApp.id}/mention`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: mentionUser, note: mentionNote }),
            });
            setMentionNote('');
            setMentionSuccess(true);
            setTimeout(() => setMentionSuccess(false), 3000);
        } catch (e) {
            console.error(e);
        } finally {
            setMentionLoading(false);
        }
    };

    const handleAddCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!candidateForm.name || !candidateForm.email || !candidateForm.job_posting_id) return;
        setActionLoading(true);
        try {
            await apiFetch('/v1/applicants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(candidateForm),
            });
            setCandidateSuccess(true);

            // Refresh data immediately
            fetchData(currentPage);

            // Wait 2 seconds before closing modal to show success message
            setTimeout(() => {
                setCandidateSuccess(false);
                setAddCandidateModal(false);
                setCandidateForm({ name: '', email: '', phone: '', source: 'LinkedIn', job_posting_id: '' });
            }, 2000);
        } catch (err) {
            console.error('Failed to add candidate', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateEmployeeStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee) return;
        setActionLoading(true);
        try {
            await apiFetch(`/v1/employees/${selectedEmployee.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employment_status: employeeStatusForm.status,
                    separation_reason: employeeStatusForm.reason,
                    separation_date: employeeStatusForm.date
                }),
            });
            setEmployeeStatusModal(false);
            fetchData(currentPage);
        } catch (err) {
            console.error('Failed to update employee status', err);
        } finally {
            setActionLoading(false);
        }
    };

    // Refetch when filters change
    useEffect(() => {
        if (initialTab === 'Reports') {
            fetchData(1);
        }
    }, [reportFilters]);

    const fetchData = async (page = 1) => {
        setLoading(true);
        try {
            // --- REPORTS TAB: only fetch stats, skip all other expensive calls ---
            if (initialTab === 'Reports') {
                setStatsLoading(true);
                const params = new URLSearchParams({
                    date_range: reportFilters.dateRange,
                    department: reportFilters.department,
                    job_id: reportFilters.jobId,
                    search: search
                });
                const [statsData, jobsData, turnoverData] = await Promise.all([
                    apiFetch(`/v1/applicants/stats?${params.toString()}`),
                    apiFetch('/v1/jobs?page=1'), // Fetch jobs for filters
                    apiFetch('/v1/employees/turnover')
                ]);
                setStats({ ...statsData, turnover: turnoverData?.turnover, turnoverTrend: turnoverData?.trend });
                if (jobsData?.data) setJobs(jobsData.data);
                else setJobs(jobsData || []);
                setStatsLoading(false);
                setLoading(false);
                return; // Stop here — no need for reqs/applicants on Reports
            }

            if (initialTab === 'Employees') {
                const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
                if (subTab === 'HIRED' || subTab === 'ACTIVE') {
                    // Fetch Pipeline/Newly Hired (Applicants)
                    const statusParam = subTab === 'HIRED' ? 'hired' : 'active';
                    const appsResponse = await apiFetch(`/v1/applicants?page=${page}&status=${statusParam}${searchParam}`);
                    if (appsResponse?.data) {
                        setApplicants(appsResponse.data);
                        setApplicantsPagination({
                            total: appsResponse.total,
                            current_page: appsResponse.current_page,
                            last_page: appsResponse.last_page,
                            from: appsResponse.from,
                            to: appsResponse.to
                        });
                        setCurrentPage(appsResponse.current_page);
                    } else {
                        setApplicants(appsResponse || []);
                        setApplicantsPagination(null);
                    }
                } else {
                    // Fetch Staff (STAFF or SEPARATED)
                    const empStatus = subTab === 'SEPARATED' ? 'resigned' : 'active';
                    const employeesResponse = await apiFetch(`/v1/employees?page=${page}&status=${empStatus}${searchParam}`);
                    if (employeesResponse?.data) {
                        setEmployees(employeesResponse.data);
                        setEmployeesPagination({
                            total: employeesResponse.total,
                            current_page: employeesResponse.current_page,
                            last_page: employeesResponse.last_page,
                            from: employeesResponse.from,
                            to: employeesResponse.to
                        });
                        setCurrentPage(employeesResponse.current_page);
                    } else {
                        setEmployees(employeesResponse || []);
                        setEmployeesPagination(null);
                    }
                }
                setLoading(false);
                return;
            }

            if (initialTab === 'Calendar') {
                // Calendar only needs interviews
                const interviewsData = await apiFetch(`/v1/interviews?status=scheduled`);
                setInterviewsList(interviewsData || []);
                setApplicants([]);
                setApplicantsPagination(null);
            } else if (initialTab === 'Jobs') {
                // Jobs tab: only fetch jobs — no applicants or requisitions needed here
                const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
                const jobsQuery = `/v1/jobs?page=${page}${subTab === 'ACTIVE' ? '&status=active' : '&status=archived'}${searchParam}`;
                const jobsResponse = await apiFetch(jobsQuery);
                if (jobsResponse?.data) {
                    setJobs(jobsResponse.data);
                    setJobsPagination({
                        total: jobsResponse.total,
                        current_page: jobsResponse.current_page,
                        last_page: jobsResponse.last_page,
                        from: jobsResponse.from,
                        to: jobsResponse.to
                    });
                    setCurrentPage(jobsResponse.current_page);
                } else {
                    setJobs(jobsResponse || []);
                    setJobsPagination(null);
                }
            } else if (initialTab === 'HiringPlan') {
                // Hiring Plan: only fetch requisitions
                const reqsResponse = await apiFetch('/v1/requisitions');
                setRequisitions(reqsResponse?.data || []);
            } else {
                // Candidates, Employees, and other tabs: fetch applicants + jobs (for filter dropdowns)
                const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
                const currentStatus = (() => {
                    const m: { [k: string]: string } = { 'NEW': 'new', 'INTERVIEWS': 'interview', 'OFFERS': 'offer', 'REJECTED': 'rejected', 'HIRED': 'hired', 'ACTIVE': 'active', 'ARCHIVED': 'archived', 'REQUISITIONS': 'ALL', 'OVERVIEW': 'ALL' };
                    return m[subTab] ?? 'ALL';
                })();
                const statusParam = currentStatus !== 'ALL' ? `&status=${currentStatus}` : '';

                const [jobsResponse, appsResponse] = await Promise.all([
                    apiFetch(`/v1/jobs?page=1`),
                    apiFetch(`/v1/applicants?page=${page}${statusParam}${searchParam}`),
                ]);

                if (jobsResponse?.data) {
                    setJobs(jobsResponse.data);
                    setJobsPagination(null);
                } else {
                    setJobs(jobsResponse || []);
                }

                if (appsResponse?.data) {
                    setApplicants(appsResponse.data);
                    setApplicantsPagination({
                        total: appsResponse.total,
                        current_page: appsResponse.current_page,
                        last_page: appsResponse.last_page,
                        from: appsResponse.from,
                        to: appsResponse.to
                    });
                    setCurrentPage(appsResponse.current_page);
                } else {
                    setApplicants(appsResponse || []);
                    setApplicantsPagination(null);
                }
            }
        } catch (err: any) {
            console.error('Failed to fetch dashboard data', err);
            setFetchError(err?.message || 'Failed to connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(1);
    }, [initialTab, subTab, search]); // Re-fetch when tab, subtab or search changes

    useEffect(() => {
        // Reset loading and clear data when tab changes to prevent "No Results" flicker
        setLoading(true);
        setJobs(null);
        setApplicants(null);
        setRequisitions(null);
        setStats(null);

        // Default sub-tab when global category changes
        if (initialTab === 'Candidates') setSubTab('NEW');
        else if (initialTab === 'Jobs') setSubTab('ACTIVE');
        else if (initialTab === 'Employees') setSubTab('HIRED');
        else if (initialTab === 'HiringPlan') setSubTab('REQUISITIONS');
        else if (initialTab === 'Reports') setSubTab('OVERVIEW');
        else if (initialTab === 'Calendar') setSubTab('UPCOMING');

        // Also handles initial load when switching to any other tab
        fetchData(1);
    }, [initialTab]); // Only fires when switching the main tab


    const handlePostJob = async (req: any) => {
        setActionLoading(true);
        try {
            await apiFetch('/v1/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_requisition_id: req.id,
                    title: req.title,
                    description: req.description || `New opening for ${req.title} in ${req.department} department.`,
                    location: req.location,
                    type: 'full-time',
                }),
            });
            setDrawerReq(null);
            fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleStatusUpdate = async (applicantId: string, newStatus: string) => {
        setActionLoading(true);
        try {
            await apiFetch(`/v1/applicants/${applicantId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            setDrawerApp(null);
            fetchData(currentPage);
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleScheduleInterview = async () => {
        if (!scheduleForm.date || !scheduleForm.time || !scheduleForm.interviewer_id) return;
        setActionLoading(true);
        try {
            // Combine date and time to ISO format (assume local timezone)
            const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`).toISOString();

            await apiFetch('/v1/interviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicant_id: drawerApp.id,
                    interviewer_id: scheduleForm.interviewer_id,
                    scheduled_at: scheduledAt,
                    type: scheduleForm.type,
                    location: scheduleForm.location,
                    message: scheduleForm.message
                }),
            });

            // Also update applicant status to interview
            await apiFetch(`/v1/applicants/${drawerApp.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'interview' }),
            });

            setDrawerApp((prev: any) => ({ ...prev, status: 'interview' }));
            setScheduleModal(false);
            setScheduleForm({ date: '', time: '', type: 'video', location: '', interviewer_id: '', message: '' });
            fetchData(currentPage);
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendOffer = async () => {
        if (!offerForm.salary.trim()) return;
        setActionLoading(true);
        try {
            await apiFetch(`/v1/applicants/${drawerApp.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'offer',
                    offered_salary: offerForm.salary,
                    start_date: offerForm.startDate,
                    offer_notes: offerForm.notes,
                }),
            });
            setDrawerApp((prev: any) => ({ ...prev, status: 'offer' }));
            setOfferModal(false);
            setOfferForm({ salary: '', startDate: '', notes: '' });
            fetchData(currentPage);
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendRejection = async () => {
        setActionLoading(true);
        try {
            await apiFetch(`/v1/applicants/${drawerApp.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'rejected', rejection_note: rejectionNote }),
            });
            setDrawerApp((prev: any) => ({ ...prev, status: 'rejected' }));
            setRejectModal(false);
            setRejectionNote('');
            fetchData(currentPage);
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleJobStatus = async (jobId: string, newStatus: string) => {
        setActionLoading(true);
        try {
            await apiFetch(`/v1/jobs/${jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Connection error banner */}
            <AnimatePresence>
                {fetchError && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mx-10 mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4"
                    >
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-black text-red-700 uppercase tracking-wide">Connection Error</p>
                            <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
                        </div>
                        <button
                            onClick={() => { setFetchError(null); fetchData(1); }}
                            className="px-4 py-2 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-600 transition-all"
                        >
                            Retry
                        </button>
                        <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search Active Banner */}
            <AnimatePresence>
                {search && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mx-10 mt-2 p-3 bg-[#1F7A6E]/10 border border-[#1F7A6E]/20 rounded-2xl flex items-center gap-4"
                    >
                        <svg className="w-4 h-4 text-[#1F7A6E] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-xs font-bold text-[#1F7A6E] flex-1">
                            Showing results for: <span className="font-black text-[#1A2B3D]">"{search}"</span>
                        </p>
                        <button
                            onClick={() => {
                                const url = new URL(window.location.href);
                                url.searchParams.delete('search');
                                window.history.replaceState({}, '', url);
                                setSearch('');
                            }}
                            className="text-[10px] font-black text-[#1F7A6E] uppercase tracking-widest hover:text-[#165C53] transition-colors"
                        >
                            Clear ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Page Header */}

            <div className="flex justify-between items-end mb-4">
                <div className="space-y-4">
                    {/* Breadcrumb trail */}
                    {(() => {
                        const tabLabels: { [key: string]: string } = {
                            'Candidates': 'Candidates',
                            'Jobs': 'Jobs',
                            'HiringPlan': 'Salary & Hiring',
                            'Employees': 'Employees',
                            'Reports': 'Reports',
                        };
                        const subLabels: { [key: string]: string } = {
                            'NEW': 'New',
                            'INTERVIEWS': 'Interviews',
                            'OFFERS': 'Offers',
                            'REJECTED': 'Rejected',
                            'HIRED': 'Newly Hired',
                            'ACTIVE': 'Active Pipeline',
                            'STAFF': 'Professional Staff',
                            'SEPARATED': 'Separated Staff',
                            'ARCHIVED': 'Archived',
                            'REQUISITIONS': 'Requisitions',
                            'OVERVIEW': 'Overview',
                        };
                        return (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <span className="hover:text-[#1F7A6E] cursor-pointer transition-colors">Sister Companies</span>
                                <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                                <span className="text-[#1F7A6E]">{user.tenant?.name || 'Droga Pharma'}</span>
                                <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                                <span>{tabLabels[initialTab] || initialTab}</span>
                                {subLabels[subTab] && (
                                    <>
                                        <svg className="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                                        <span className="text-[#1A2B3D] font-black">{subLabels[subTab]}</span>
                                    </>
                                )}
                            </div>
                        );
                    })()}

                    <h1 className="text-[32px] font-bold text-[#1A2B3D] tracking-tight">{user.tenant?.name || 'Droga Pharma'}</h1>

                    {/* Hierarchical Sub Tabs - Contextual Logic */}
                    <div className="flex gap-10 border-b border-gray-100 mt-2">
                        {(() => {
                            let items: string[] = [];
                            if (initialTab === 'Candidates') items = ['NEW', 'INTERVIEWS', 'OFFERS', 'REJECTED'];
                            else if (initialTab === 'Jobs' || initialTab === 'HiringPlan') items = ['JOBS', 'HIRING PLAN'];
                            else if (initialTab === 'Employees') items = ['HIRED', 'ACTIVE', 'STAFF', 'SEPARATED'];
                            else if (initialTab === 'Reports') items = ['OVERVIEW'];
                            else items = ['OVERVIEW'];

                            return items.map((t) => {
                                const isSectionActive = (t === 'JOBS' && initialTab === 'Jobs') || (t === 'HIRING PLAN' && initialTab === 'HiringPlan');
                                const isSubActive = subTab === t;
                                const isActive = isSectionActive || isSubActive;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            if (t === 'JOBS' && initialTab !== 'Jobs') {
                                                router.push('/dashboard?tab=Jobs');
                                            } else if (t === 'HIRING PLAN' && initialTab !== 'HiringPlan') {
                                                router.push('/dashboard?tab=HiringPlan');
                                            } else if (t !== 'JOBS' && t !== 'HIRING PLAN') {
                                                setSubTab(t);
                                                setCurrentPage(1);
                                            }
                                        }}
                                        className={`pb-4 text-[12px] font-black tracking-[0.15em] transition-all relative ${isActive
                                            ? 'text-[#1F7A6E]'
                                            : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                    >
                                        <span className="uppercase">{t}</span>
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeSubTabIndicator"
                                                className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#1F7A6E] rounded-t-full"
                                            />
                                        )}
                                    </button>
                                );
                            });
                        })()}

                        {(initialTab === 'Jobs' || initialTab === 'HiringPlan') && (
                            <div className="flex gap-6 ml-4 border-l border-gray-100 pl-10 h-6 self-start mt-0.5 items-center">
                                {(initialTab === 'Jobs' ? ['ACTIVE', 'ARCHIVED'] : ['REQUISITIONS']).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => { setSubTab(f); setCurrentPage(1); }}
                                        className={`text-[10px] font-black tracking-widest transition-all ${subTab === f ? 'text-[#1A2B3D]' : 'text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {subTab === 'REQUISITIONS' && (
                    <button className="bg-[#1F7A6E] hover:bg-[#165C53] text-white px-6 py-3 rounded font-black text-[13px] tracking-wide shadow-xl shadow-[#1F7A6E]/20 transition-all flex items-center gap-2">
                        Create new requisition
                    </button>
                )}
            </div>

            {/* Content Table */}
            {loading ? (
                initialTab === 'Jobs' ? (
                    /* Jobs skeleton */
                    <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[#F9FAFB] border-b border-gray-100">
                                <tr>
                                    {['POSITION', 'LOCATION', 'DEPARTMENT', 'STATUS', 'ACTIONS'].map(h => (
                                        <th key={h} className="px-8 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 animate-pulse">
                                {[...Array(6)].map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-8 py-5">
                                            <div className="h-3.5 bg-gray-100 rounded w-40 mb-1.5" />
                                            <div className="h-2.5 bg-gray-100 rounded w-24" />
                                        </td>
                                        <td className="px-8 py-5"><div className="h-3 bg-gray-100 rounded w-28" /></td>
                                        <td className="px-8 py-5"><div className="h-3 bg-gray-100 rounded w-32" /></td>
                                        <td className="px-8 py-5"><div className="h-6 bg-gray-100 rounded-full w-16" /></td>
                                        <td className="px-8 py-5"><div className="h-3 bg-gray-100 rounded w-20" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="bg-white rounded border border-gray-100 p-20 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-[#1F7A6E] border-t-transparent rounded-full animate-spin" />
                    </div>
                )
            ) : initialTab === 'Jobs' ? (
                <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                    <table className="w-full text-left">
                        <thead className="bg-[#F9FAFB] border-b border-gray-100">
                            <tr>
                                {['POSITION', 'LOCATION', 'DEPARTMENT', 'STATUS', 'ACTIONS'].map(h => (
                                    <th key={h} className="px-8 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {jobs === null ? null : jobs.length === 0 ? (
                                <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic text-sm">No {subTab.toLowerCase()} jobs found for {user.tenant?.name || 'this company'}.</td></tr>
                            ) : jobs.map((job: any) => (
                                <tr key={job.id} className="hover:bg-gray-50 transition-colors cursor-pointer group">
                                    <td className="px-8 py-6">
                                        <p className="font-bold text-[#1A2B3D] group-hover:text-[#1F7A6E] transition-colors">{job.title}</p>
                                    </td>
                                    <td className="px-8 py-6 text-sm text-gray-500">{job.location || '—'}</td>
                                    <td className="px-8 py-6 text-sm text-gray-500">
                                        {job.department || job.requisition?.department || 'General'}
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${job.status === 'active' ? 'bg-emerald-50 text-emerald-600' : job.status === 'closed' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        {job.status === 'active' ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleJobStatus(job.id, 'closed'); }}
                                                className="px-4 py-2 border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-50 transition-all"
                                            >
                                                Close Job
                                            </button>
                                        ) : job.status === 'closed' ? (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleJobStatus(job.id, 'active'); }}
                                                className="px-4 py-2 border border-emerald-200 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-50 transition-all"
                                            >
                                                Re-open
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Jobs Pagination Controls */}
                    {jobsPagination && jobsPagination.last_page > 1 && (
                        <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                    Showing <span className="text-[#1A2B3D]">{jobsPagination.from}</span> - <span className="text-[#1A2B3D]">{jobsPagination.to}</span> of <span className="text-[#1A2B3D]">{jobsPagination.total}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchData(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#1F7A6E] hover:border-[#1F7A6E] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                                </button>

                                {Array.from({ length: Math.min(5, jobsPagination.last_page) }, (_, i) => {
                                    let pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                                    if (pageNum > jobsPagination.last_page) pageNum = jobsPagination.last_page - (4 - i);
                                    if (pageNum < 1) pageNum = i + 1;
                                    if (pageNum > jobsPagination.last_page) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => fetchData(pageNum)}
                                            className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all shadow-sm border ${currentPage === pageNum
                                                ? 'bg-[#1F7A6E] text-white border-[#1F7A6E]'
                                                : 'bg-white text-gray-400 border-gray-200 hover:border-[#1F7A6E] hover:text-[#1F7A6E]'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}

                                <button
                                    onClick={() => fetchData(currentPage + 1)}
                                    disabled={currentPage === jobsPagination.last_page}
                                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#1F7A6E] hover:border-[#1F7A6E] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}

            {(['Candidates', 'Employees'].includes(initialTab)) && (
                <div className="flex flex-col">
                    {/* Header Section without inner filters */}
                    <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-white">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-[#1A2B3D] flex items-center gap-3">
                                <div className="w-2 h-8 bg-[#1F7A6E] rounded-full" />
                                {subTab} PIPELINE
                            </h2>
                            <p className="text-xs font-medium text-gray-400">Manage talent through the {subTab.toLowerCase()} stage</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {initialTab === 'Candidates' && (
                                <button
                                    onClick={() => setAddCandidateModal(true)}
                                    className="bg-[#1F7A6E] hover:bg-[#165C53] text-white px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#1F7A6E]/20 transition-all flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                    Add Candidate
                                </button>
                            )}
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                                Total: <span className="text-[#1A2B3D]">
                                    {loading ? '...' : (initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED')) ? (employeesPagination?.total ?? 0) : (applicantsPagination?.total ?? 0)}
                                </span>
                            </p>
                        </div>
                    </div>

                    <table className="w-full text-left">
                        <thead className="bg-[#F9FAFB] border-b border-gray-100">
                            <tr>
                                {(initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED'))
                                    ? ['CANDIDATE', 'ROLE', 'DEPARTMENT', 'STATUS', subTab === 'SEPARATED' ? 'SEPARATION DATE' : 'JOINED DATE', 'ACTIONS'].map(h => (
                                        <th key={h} className="px-8 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))
                                    : ['CANDIDATE', 'APPLIED FOR', 'DEPARTMENT', 'EXPERIENCE', 'MATCHING', 'STATUS', 'APPLIED ON', (initialTab === 'Employees' ? 'ACTIONS' : null)].filter(Boolean).map(h => (
                                        <th key={h} className="px-8 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {(initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED')) ? (
                                employees === null ? null : employees.length === 0 ? (
                                    <tr><td colSpan={7} className="px-8 py-20 text-center text-gray-400 italic text-sm">No internal users found in this category.</td></tr>
                                ) : (
                                    employees.map((emp: any) => (
                                        <tr key={emp.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-black text-[#1F7A6E]">
                                                        {emp.name.split(' ').map((n: string) => n[0]).join('')}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-[14px] text-[#1A2B3D]">{emp.name}</p>
                                                        <p className="text-[10px] font-bold text-gray-400 lowercase tracking-widest">{emp.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-[13px] text-gray-600 font-medium lowercase">
                                                {emp.roles?.map((r: any) => r.name).join(', ') || 'Staff'}
                                            </td>
                                            <td className="px-8 py-6 text-[13px] text-gray-600 font-medium">
                                                {emp.department || '-'}
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${emp.employment_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                                    }`}>
                                                    {emp.employment_status}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-[13px] text-gray-600">
                                                {subTab === 'SEPARATED'
                                                    ? (emp.separation_date ? new Date(emp.separation_date).toLocaleDateString() : 'N/A')
                                                    : (emp.joined_date ? new Date(emp.joined_date).toLocaleDateString() : '-')}
                                            </td>
                                            <td className="px-8 py-6">
                                                <button
                                                    onClick={() => {
                                                        setSelectedEmployee(emp);
                                                        setEmployeeStatusForm({
                                                            status: emp.employment_status,
                                                            reason: emp.separation_reason || '',
                                                            date: emp.separation_date || new Date().toISOString().split('T')[0]
                                                        });
                                                        setEmployeeStatusModal(true);
                                                    }}
                                                    className="text-[10px] font-black text-[#1F7A6E] uppercase tracking-widest hover:underline"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                applicants === null ? null : applicants.length === 0 ? (
                                    <tr><td colSpan={7} className="px-8 py-20 text-center text-gray-400 italic text-sm">No {subTab.toLowerCase()} talent currently in the pipeline for {user.tenant?.name || 'this company'}.</td></tr>
                                ) : (
                                    applicants.map((app: any) => (
                                        <tr
                                            key={app.id}
                                            className="hover:bg-gray-50 transition-colors group cursor-pointer"
                                            onClick={() => setDrawerApp(app)}
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative group/avatar">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden border border-gray-100 group-hover:border-[#1F7A6E] transition-all duration-300 shadow-sm">
                                                            {app.photo_path ? (
                                                                <img
                                                                    src={app.photo_path.startsWith('http') ? app.photo_path : `${API_URL.replace('/api', '/storage')}/${app.photo_path}`}
                                                                    alt=""
                                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110"
                                                                    onError={(e) => {
                                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(app.name)}&background=1F7A6E&color=fff&bold=true`;
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span className="text-sm font-black text-[#1F7A6E]">{app.name.split(' ').map((n: string) => n[0]).join('')}</span>
                                                            )}
                                                        </div>
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <p className="font-black text-[14px] text-[#1A2B3D] tracking-tight group-hover:text-[#1F7A6E] transition-colors">{app.name}</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{app.email}</span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-200" />
                                                            <span className="text-[10px] font-bold text-[#1F7A6E] uppercase tracking-widest">{app.phone || 'No Phone'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="text-[13px] font-bold text-[#1A2B3D]">{app.job_posting?.title || 'Open Role'}</p>
                                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest mt-0.5">Reference: REQ{app.job_posting?.job_requisition_id || '---'}</p>
                                            </td>
                                            <td className="px-8 py-6 text-[13px] text-gray-600 font-medium">
                                                {app.job_posting?.department || app.job_posting?.requisition?.department || '-'}
                                            </td>
                                            <td className="px-8 py-6 text-[13px] text-gray-600">
                                                {app.years_of_experience || '0'} Years
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full"
                                                            style={{ width: `${app.match_score || 85}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] font-black text-[#1A2B3D]">{app.match_score || 85}%</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {app.status === 'interview' && app.interviews && app.interviews.length > 0 ? (
                                                    <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-purple-50 text-purple-600">
                                                        Scheduled: {(() => {
                                                            const d = new Date(app.interviews[0].scheduled_at);
                                                            return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                                                        })()}
                                                    </span>
                                                ) : (
                                                    <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${app.status === 'hired' ? 'bg-emerald-50 text-emerald-600' :
                                                        app.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                                            app.status === 'interview' ? 'bg-purple-50 text-purple-600' :
                                                                app.status === 'offer' ? 'bg-amber-50 text-amber-600' :
                                                                    'bg-blue-50 text-blue-600'
                                                        }`}>
                                                        {app.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-6">
                                                {app.created_at ? (() => {
                                                    const d = new Date(app.created_at);
                                                    const now = new Date();
                                                    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                                                    const relative = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`;
                                                    return (
                                                        <div>
                                                            <p className="text-[12px] font-bold text-[#1A2B3D]">
                                                                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </p>
                                                            <p className="text-[11px] text-gray-400 mt-0.5">
                                                                {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · <span className="text-[#1F7A6E] font-black">{relative}</span>
                                                            </p>
                                                        </div>
                                                    );
                                                })() : <span className="text-gray-300 text-xs">—</span>}
                                            </td>
                                            {initialTab === 'Employees' && (
                                                <td className="px-8 py-6">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDrawerApp(app);
                                                        }}
                                                        className="text-[10px] font-black text-[#1F7A6E] uppercase tracking-widest hover:underline"
                                                    >
                                                        Manage
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {/* Pagination Controls */}
                    {((initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED')) ? employeesPagination : applicantsPagination) && ((initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED')) ? employeesPagination : applicantsPagination).last_page > 1 && (
                        <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                    Showing <span className="text-[#1A2B3D]">{((initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED')) ? employeesPagination : applicantsPagination).from}</span> - <span className="text-[#1A2B3D]">{((initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED')) ? employeesPagination : applicantsPagination).to}</span> of <span className="text-[#1A2B3D]">{((initialTab === 'Employees' && (subTab === 'STAFF' || subTab === 'SEPARATED')) ? employeesPagination : applicantsPagination).total}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchData(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#1F7A6E] hover:border-[#1F7A6E] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                                </button>

                                {[...Array(((initialTab === 'Employees' && subTab !== 'HIRED') ? employeesPagination : applicantsPagination).last_page)].map((_, i) => (
                                    <button
                                        key={i + 1}
                                        onClick={() => fetchData(i + 1)}
                                        className={`w-10 h-10 rounded-xl text-[11px] font-black transition-all shadow-sm border ${currentPage === i + 1
                                            ? 'bg-[#1F7A6E] text-white border-[#1F7A6E]'
                                            : 'bg-white text-gray-400 border-gray-200 hover:border-[#1F7A6E] hover:text-[#1F7A6E]'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}

                                <button
                                    onClick={() => fetchData(currentPage + 1)}
                                    disabled={currentPage === ((initialTab === 'Employees' && subTab !== 'HIRED') ? employeesPagination : applicantsPagination).last_page}
                                    className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#1F7A6E] hover:border-[#1F7A6E] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div >
            )
            }

            {
                initialTab === 'HiringPlan' && (
                    <table className="w-full text-left">
                        <thead className="bg-[#F9FAFB] border-b border-gray-100">
                            <tr>
                                {['REQUISITION', 'HIRING MANAGER', 'LOCATION', 'SALARY', 'SUBMITTED ON', 'POSTED TO PORTAL', 'STATUS'].map(h => (
                                    <th key={h} className="px-8 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {requisitions === null ? null : requisitions.length === 0 ? (
                                <tr><td colSpan={7} className="px-8 py-20 text-center text-gray-400 italic text-sm">No hiring plan items yet for {user.tenant?.name || 'this company'}.</td></tr>
                            ) : requisitions.map((req: any) => (
                                <tr
                                    key={req.id}
                                    className="hover:bg-gray-50 transition-colors group cursor-pointer"
                                    onClick={() => setDrawerReq(req)}
                                >
                                    <td className="px-8 py-6">
                                        <p className="font-black text-[13px] text-[#0066CC] hover:underline group-hover:text-[#1F7A6E]">
                                            REQ{req.id} {req.title}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5 tracking-tight">
                                            {req.department} · {req.tenant?.name || user.tenant?.name || 'Droga Pharma'}
                                        </p>
                                    </td>
                                    <td className="px-8 py-6 text-[13px] text-gray-600">
                                        {req.requester?.name || 'Hiring Manager'}
                                    </td>
                                    <td className="px-8 py-6 text-[13px] text-gray-600">
                                        {req.location}
                                    </td>
                                    <td className="px-8 py-6 text-[13px] text-[#1A2B3D] font-black">
                                        {req.budget ? req.budget.toLocaleString() : '15,000'} ETB /mo
                                    </td>
                                    <td className="px-8 py-6">
                                        {req.created_at ? (() => {
                                            const d = new Date(req.created_at);
                                            return (
                                                <div>
                                                    <p className="text-[12px] font-bold text-[#1A2B3D]">
                                                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            );
                                        })() : <span className="text-gray-300">—</span>}
                                    </td>
                                    <td className="px-8 py-6">
                                        {req.job_posting?.created_at ? (() => {
                                            const d = new Date(req.job_posting.created_at);
                                            return (
                                                <div>
                                                    <p className="text-[12px] font-bold text-[#1A2B3D]">
                                                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-[11px] text-emerald-600 font-bold mt-0.5">
                                                        {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            );
                                        })() : (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded">
                                                Not Posted
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                            req.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                                                'bg-red-50 text-red-500'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
            }

            {
                initialTab === 'Calendar' && (
                    <div className="flex flex-col">
                        <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-white">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black text-[#1A2B3D] flex items-center gap-3">
                                    <div className="w-2 h-8 bg-[#1F7A6E] rounded-full" />
                                    INTERVIEW CALENDAR
                                </h2>
                                <p className="text-xs font-medium text-gray-400">Manage and view all upcoming scheduled interviews</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                                    Upcoming: <span className="text-[#1A2B3D]">{interviewsList.length}</span>
                                </p>
                            </div>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-[#F9FAFB] border-b border-gray-100">
                                <tr>
                                    {['CANDIDATE', 'CONTACT', 'INTERVIEW DATE & TIME', 'TYPE', 'STATUS'].map(h => (
                                        <th key={h} className="px-8 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {interviewsList.length === 0 ? (
                                    <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic text-sm">No scheduled interviews found.</td></tr>
                                ) : interviewsList.map((interview: any) => (
                                    <tr key={interview.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => {
                                        if (interview.applicant) setDrawerApp(interview.applicant);
                                    }}>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-black">
                                                    {interview.applicant?.name?.charAt(0) || 'C'}
                                                </div>
                                                <div>
                                                    <p className="font-black text-[13px] text-[#1A2B3D]">{interview.applicant?.name || 'Unknown'}</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">{interview.applicant?.job_posting?.title || 'Open Role'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-[12px] font-medium text-gray-600">{interview.applicant?.email || 'N/A'}</p>
                                            <p className="text-[11px] text-gray-400">{interview.applicant?.phone || '-'}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#1F7A6E] group-hover:text-white transition-colors">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-[#1A2B3D] text-[13px]">
                                                        {new Date(interview.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </p>
                                                    <p className="text-[#1F7A6E] font-black text-[11px]">
                                                        {new Date(interview.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-[13px] text-gray-600 capitalize font-medium">
                                            {interview.type}
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                                                Confirmed
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            }

            {
                initialTab === 'Reports' && (
                    <div className="bg-gray-50/50 min-h-[calc(100vh-100px)]">


                        {statsLoading && !stats ? (
                            /* Skeleton placeholder while data loads */
                            <div className="p-10 space-y-6 animate-pulse">
                                <div className="grid grid-cols-4 gap-6">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                                                <div className="h-5 bg-gray-100 rounded w-1/2" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-10">
                                    <div className="bg-white rounded-[32px] border border-gray-100 h-64" />
                                    <div className="space-y-6">
                                        <div className="bg-white rounded-[32px] border border-gray-100 h-28" />
                                        <div className="bg-white rounded-[32px] border border-gray-100 h-32" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-10 space-y-6">

                                {/* ── Top Greeting ── */}
                                <div className="flex items-end justify-between">
                                    <div>
                                        <h2 className="text-3xl font-black text-[#1A2B3D]">Welcome, {user.name}!</h2>
                                        <p className="text-sm font-medium text-gray-500 mt-1">Manage candidates and track applications</p>
                                    </div>
                                    {/* Live data badge */}
                                    <div className="flex items-center gap-2 bg-white border border-gray-100 shadow-sm px-3 py-1.5 rounded-xl">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Data</span>
                                    </div>
                                </div>

                                {/* ── Horizontal Filter Utility Bar ── */}
                                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-5 py-3.5 flex items-center gap-3 flex-wrap">

                                    {/* Section label */}
                                    <div className="flex items-center gap-2 pr-4 border-r border-gray-100">
                                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                                        </svg>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filters</span>
                                    </div>

                                    {/* Timeframe */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest hidden sm:block">Timeframe</span>
                                        <select
                                            value={reportFilters.dateRange}
                                            onChange={e => { setReportFilters(prev => ({ ...prev, dateRange: e.target.value })); fetchData(1); }}
                                            className="text-[11px] font-bold text-[#1A2B3D] bg-gray-50/80 border border-gray-100 rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-[#1F7A6E] hover:border-gray-200 transition-all appearance-none shadow-sm"
                                        >
                                            <option value="7">Last 7 Days</option>
                                            <option value="30">Last 30 Days</option>
                                            <option value="90">Last 90 Days</option>
                                            <option value="All">All Time</option>
                                        </select>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-5 w-px bg-gray-100" />

                                    {/* Department */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest hidden sm:block">Department</span>
                                        <select
                                            value={reportFilters.department}
                                            onChange={e => { setReportFilters(prev => ({ ...prev, department: e.target.value })); fetchData(1); }}
                                            className="text-[11px] font-bold text-[#1A2B3D] bg-gray-50/80 border border-gray-100 rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-[#1F7A6E] hover:border-gray-200 transition-all appearance-none shadow-sm max-w-[160px]"
                                        >
                                            <option value="All">All Departments</option>
                                            {[...new Set((jobs || []).map(j => j.department || j.requisition?.department).filter(Boolean))].map(dept => (
                                                <option key={String(dept)} value={String(dept)}>{String(dept)}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-5 w-px bg-gray-100" />

                                    {/* Specific Role */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest hidden sm:block">Role</span>
                                        <select
                                            value={reportFilters.jobId}
                                            onChange={e => { setReportFilters(prev => ({ ...prev, jobId: e.target.value })); fetchData(1); }}
                                            className="text-[11px] font-bold text-[#1A2B3D] bg-gray-50/80 border border-gray-100 rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-[#1F7A6E] hover:border-gray-200 transition-all appearance-none shadow-sm max-w-[180px]"
                                        >
                                            <option value="All">All Open Roles</option>
                                            {(jobs || []).map(job => (
                                                <option key={job.id} value={job.id}>{job.title}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Spacer — pushes refresh to the far right */}
                                    <div className="flex-1" />

                                    {/* Refresh icon button (far right) */}
                                    <button
                                        onClick={() => fetchData(1)}
                                        title="Refresh data"
                                        className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all shadow-sm ${statsLoading
                                            ? 'bg-[#1F7A6E]/5 border-[#1F7A6E]/20 text-[#1F7A6E] cursor-not-allowed'
                                            : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-[#1F7A6E]/5 hover:border-[#1F7A6E]/30 hover:text-[#1F7A6E]'
                                            }`}
                                    >
                                        <svg
                                            className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`}
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>

                                {/* KPI Row (Top): Executive Summary Layer */}
                                <div className="grid grid-cols-4 gap-8">
                                    {[
                                        {
                                            label: 'Total Employees',
                                            value: stats?.total_employees?.toLocaleString() || '0',
                                            trend: `${stats?.total_employees_trend > 0 ? '+' : ''}${stats?.total_employees_trend || 0}% from last month`,
                                            isPositive: true,
                                            icon: (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                            ),
                                            color: 'text-indigo-500',
                                            bg: 'bg-indigo-50/50'
                                        },
                                        {
                                            label: 'Active Applicants',
                                            value: stats?.funnel?.applied?.toLocaleString() || '0',
                                            trend: '-1.3% from last week',
                                            isPositive: false,
                                            icon: (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            ),
                                            color: 'text-amber-500',
                                            bg: 'bg-amber-50/50'
                                        },
                                        {
                                            label: 'Retention Rate',
                                            value: (stats?.retention_rate || 98) + '%',
                                            trend: stats?.retention_rate >= 95 ? '+0.5% Healthy' : '-1.2% Review Needed',
                                            isPositive: (stats?.retention_rate || 98) >= 95,
                                            icon: (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 12m0 8h5.082m-5.082-5H19a4 4 0 003.582-5H19" />
                                                </svg>
                                            ),
                                            color: 'text-[#1F7A6E]',
                                            bg: 'bg-[#1F7A6E]/5'
                                        },
                                        {
                                            label: 'Ongoing Job Openings',
                                            value: stats?.total_active_jobs || 0,
                                            trend: `${stats?.total_active_jobs_trend > 0 ? '+' : ''}${stats?.total_active_jobs_trend || 0}% Growth`,
                                            isPositive: true,
                                            icon: (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                            ),
                                            color: 'text-orange-500',
                                            bg: 'bg-orange-50/50'
                                        },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 shadow-sm`}>
                                                    {stat.icon}
                                                </div>
                                                <p className="text-[13px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                            </div>
                                            <div>
                                                <p className="text-[34px] font-black text-[#1A2B3D] tracking-tighter leading-none mb-3">{stat.value}</p>
                                                <div className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${stat.trend === 'Positions' ? 'text-gray-300' : stat.isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                                                    {stat.trend !== 'Positions' && (
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            {stat.isPositive ? (
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 15l7-7 7 7" />
                                                            ) : (
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M19 9l-7 7-7-7" />
                                                            )}
                                                        </svg>
                                                    )}
                                                    {stat.trend}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Analytics Layer (Middle): Larger Chart Modules */}
                                <div className="grid grid-cols-2 gap-8">
                                    {/* Employee Turnover — Premium Spline Area Chart */}
                                    <div className="bg-white p-8 rounded-[24px] border border-gray-100 shadow-sm flex flex-col relative overflow-hidden hover:shadow-md transition-all duration-300">

                                        {/* ── Header ── */}
                                        <div className="flex justify-between items-start mb-6 relative z-10">
                                            <div>
                                                <h3 className="text-[18px] font-black text-[#1A2B3D] tracking-tight">Employee Turnover</h3>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Growth Analytics</p>
                                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${stats?.turnoverTrend < 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' : 'bg-red-50 text-red-600 border-red-100/50'}`}>
                                                        <svg className="w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            {stats?.turnoverTrend < 0 ? (
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M19 9l-7 7-7-7" />
                                                            ) : (
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 15l7-7 7 7" />
                                                            )}
                                                        </svg>
                                                        <span className="text-[10px] font-black">{stats?.turnoverTrend > 0 ? '+' : ''}{stats?.turnoverTrend || 0}% from last month</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Trend</span>
                                                </div>
                                                <select className="bg-white border text-[10px] font-black uppercase tracking-widest text-gray-500 border-gray-200 rounded-xl px-4 py-2 outline-none cursor-pointer hover:border-[#1F7A6E] transition-all appearance-none shadow-sm">
                                                    <option>Yearly</option>
                                                    <option>Monthly</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* ── Chart body (relative container) ── */}
                                        <div className="relative" style={{ height: 200 }}>

                                            {/* Y-axis floating labels + ultra-pale dashed horizontals — NO cage/border lines */}
                                            <div className="absolute inset-0 pointer-events-none" style={{ paddingLeft: 36, paddingBottom: 24, paddingTop: 4 }}>
                                                {[100, 80, 60, 40, 20, 0].map((v) => {
                                                    const topPct = ((100 - v) / 100) * 100;
                                                    return (
                                                        <div
                                                            key={v}
                                                            className="absolute left-0 right-0 flex items-center"
                                                            style={{ top: `${topPct}%` }}
                                                        >
                                                            <span className="text-[10px] text-gray-200 font-semibold w-8 text-right select-none pr-2 shrink-0 leading-none">{v}</span>
                                                            {v > 0 && <div className="flex-1 border-t border-dashed" style={{ borderColor: 'rgba(0,0,0,0.045)' }} />}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* SVG — no viewBox outline, no axes strokes */}
                                            <svg
                                                className="absolute inset-0 w-full h-full overflow-visible"
                                                style={{ paddingLeft: 36, paddingBottom: 24, paddingTop: 4, paddingRight: 4 }}
                                                viewBox="0 0 400 160"
                                                preserveAspectRatio="none"
                                                onMouseLeave={() => setHoveredPoint(null)}
                                                onMouseMove={(e) => {
                                                    if (!stats?.turnover?.length) return;
                                                    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                                                    const relX = (e.clientX - rect.left) / rect.width;
                                                    const n = stats.turnover.length;
                                                    setHoveredPoint(Math.max(0, Math.min(n - 1, Math.round(relX * (n - 1)))));
                                                }}
                                            >
                                                <defs>
                                                    {/* 3-stop airy gradient: 30% → 5% → 0% — light and modern */}
                                                    <linearGradient id="toGrad2" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#1F7A6E" stopOpacity="0.30" />
                                                        <stop offset="60%" stopColor="#1F7A6E" stopOpacity="0.06" />
                                                        <stop offset="100%" stopColor="#1F7A6E" stopOpacity="0.00" />
                                                    </linearGradient>
                                                </defs>

                                                {(() => {
                                                    if (!stats?.turnover || stats.turnover.length < 2) return null;
                                                    const W = 400, H = 160, pad = 6;
                                                    const n = stats.turnover.length;

                                                    // Map each data point to SVG coords (rate 0-20 → full height)
                                                    const pts: { x: number; y: number }[] = stats.turnover.map((d: any, i: number) => ({
                                                        x: pad + (i / (n - 1)) * (W - pad * 2),
                                                        y: pad + ((20 - Math.min(d.rate ?? 0, 20)) / 20) * (H - pad * 2)
                                                    }));

                                                    // Catmull-Rom spline → cubic Bézier (gives true smooth curves, no sharp peaks)
                                                    function splinePath(pts: { x: number; y: number }[]): string {
                                                        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
                                                        for (let i = 0; i < pts.length - 1; i++) {
                                                            const p0 = pts[Math.max(i - 1, 0)];
                                                            const p1 = pts[i];
                                                            const p2 = pts[i + 1];
                                                            const p3 = pts[Math.min(i + 2, pts.length - 1)];
                                                            // Standard Catmull-Rom tension = 1/6
                                                            const cp1x = p1.x + (p2.x - p0.x) / 6;
                                                            const cp1y = p1.y + (p2.y - p0.y) / 6;
                                                            const cp2x = p2.x - (p3.x - p1.x) / 6;
                                                            const cp2y = p2.y - (p3.y - p1.y) / 6;
                                                            d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
                                                        }
                                                        return d;
                                                    }

                                                    const linePath = splinePath(pts);
                                                    const areaPath = `${linePath} L ${pts[n - 1].x} ${H} L ${pts[0].x} ${H} Z`;

                                                    const hp = hoveredPoint;
                                                    const hx = hp !== null ? pts[hp]?.x : null;
                                                    const hy = hp !== null ? pts[hp]?.y : null;

                                                    return (
                                                        <>
                                                            {/* 1. Area fill — airy gradient, no solid block */}
                                                            <path d={areaPath} fill="url(#toGrad2)" />

                                                            {/* 2. Catmull-Rom spline trend line */}
                                                            <path
                                                                d={linePath}
                                                                fill="none"
                                                                stroke="#1F7A6E"
                                                                strokeWidth="3"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />

                                                            {/* 3. Dynamic crosshair — vertical dashed line that follows the mouse */}
                                                            {hx !== null && (
                                                                <line
                                                                    x1={hx} y1={pad}
                                                                    x2={hx} y2={H - pad}
                                                                    stroke="#1F7A6E"
                                                                    strokeWidth="1.5"
                                                                    strokeDasharray="5 4"
                                                                    strokeOpacity="0.28"
                                                                />
                                                            )}

                                                            {/* 4. Active point: outer glow → mid ring → solid dot */}
                                                            {hx !== null && hy !== null && (
                                                                <g>
                                                                    <circle cx={hx} cy={hy} r="12" fill="rgba(31,122,110,0.07)" />
                                                                    <circle cx={hx} cy={hy} r="7" fill="rgba(31,122,110,0.14)" />
                                                                    <circle cx={hx} cy={hy} r="4" fill="#1A2B3D" stroke="white" strokeWidth="2.5" />
                                                                </g>
                                                            )}

                                                            {/* Full invisible hit rect to ensure onMouseMove fires everywhere */}
                                                            <rect x={0} y={0} width={W} height={H} fill="transparent" />
                                                        </>
                                                    );
                                                })()}
                                            </svg>

                                            {/* High-contrast black tooltip — white text on dark bg, appears near active point */}
                                            <AnimatePresence>
                                                {hoveredPoint !== null && stats?.turnover?.[hoveredPoint] && (() => {
                                                    const d = stats.turnover[hoveredPoint];
                                                    const n = stats.turnover.length;
                                                    const leftPct = (hoveredPoint / (n - 1)) * 100;
                                                    const isRight = hoveredPoint >= n * 0.7;
                                                    return (
                                                        <motion.div
                                                            key={hoveredPoint}
                                                            initial={{ opacity: 0, scale: 0.88, y: 6 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.88 }}
                                                            transition={{ duration: 0.12 }}
                                                            style={{
                                                                position: 'absolute',
                                                                top: 8,
                                                                ...(isRight
                                                                    ? { right: `calc(${100 - leftPct}% + 10px)` }
                                                                    : { left: `calc(${leftPct}% + 48px)` }),
                                                                zIndex: 60,
                                                            }}
                                                            className="bg-[#0F1C28] pointer-events-none text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 min-w-[120px]"
                                                        >
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                                                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-400">Portfolio</p>
                                                            </div>
                                                            <p className="text-[18px] font-black leading-none">{d.rate}%</p>
                                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">{d.label} 2024</p>
                                                        </motion.div>
                                                    );
                                                })()}
                                            </AnimatePresence>
                                        </div>

                                        {/* X-axis: floating month labels — no axis line, label scales on hover */}
                                        <div className="flex mt-3" style={{ paddingLeft: 36, paddingRight: 4 }}>
                                            {(stats?.turnover || []).map((t: any, i: number) => (
                                                <span
                                                    key={i}
                                                    style={{ flex: 1 }}
                                                    className={`text-center text-[9px] font-bold uppercase tracking-widest select-none transition-all ${hoveredPoint === i ? 'text-[#1F7A6E] font-black' : 'text-gray-300'}`}
                                                >
                                                    {t.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Hiring Funnel Overview — Pro SVG Bézier Funnel */}
                                    <div className="bg-white p-8 rounded-[24px] border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-all duration-300">

                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <h3 className="text-[18px] font-black text-[#1A2B3D] tracking-tight">Hiring Funnel Overview</h3>
                                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1">Candidate pipeline · {new Date().getFullYear()}</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#60A5FA]" />
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Flow</span>
                                            </div>
                                        </div>

                                        {/* KPI row */}
                                        {(() => {
                                            const stages = [
                                                { label: 'Applied', count: stats?.funnel?.applied || 0, color: '#8B5CF6' },
                                                { label: 'Shortlisted', count: stats?.funnel?.shortlisted || 0, color: '#60A5FA' },
                                                { label: 'Interviewed', count: stats?.funnel?.interview || 0, color: '#38BDF8' },
                                                { label: 'Offered', count: stats?.funnel?.offer || 0, color: '#2DD4BF' },
                                            ];
                                            const max = Math.max(...stages.map(s => s.count), 1);

                                            // SVG constants
                                            const W = 400, H = 130, padX = 0;
                                            const n = stages.length;
                                            const segW = (W - padX * 2) / n;

                                            // Compute y-coords per edge (top & bottom) for each segment boundary
                                            // height of each stage proportional to its count relative to max
                                            const halfHeights = stages.map(s => {
                                                const ratio = s.count / max;
                                                const minH = 0.18; // keep thin stages visible
                                                return ((minH + (1 - minH) * ratio) * H) / 2;
                                            });
                                            const cy = H / 2;

                                            // x positions for each stage boundary (n+1 edges)
                                            const xs = Array.from({ length: n + 1 }, (_, i) => padX + i * segW);

                                            // top / bottom y at each boundary (average of adjacent stages)
                                            const topYs = xs.map((_, xi) => {
                                                if (xi === 0) return cy - halfHeights[0];
                                                if (xi === n) return cy - halfHeights[n - 1];
                                                return cy - (halfHeights[xi - 1] + halfHeights[xi]) / 2;
                                            });
                                            const botYs = xs.map((_, xi) => {
                                                if (xi === 0) return cy + halfHeights[0];
                                                if (xi === n) return cy + halfHeights[n - 1];
                                                return cy + (halfHeights[xi - 1] + halfHeights[xi]) / 2;
                                            });

                                            // Build a smooth path per segment using cubic Bézier
                                            function segPath(i: number) {
                                                const x0 = xs[i], x1 = xs[i + 1];
                                                const cpX = (x0 + x1) / 2;
                                                // Top edge: left-to-right
                                                const topEdge = `M ${x0} ${topYs[i]} C ${cpX} ${topYs[i]}, ${cpX} ${topYs[i + 1]}, ${x1} ${topYs[i + 1]}`;
                                                // Bottom edge: right-to-left to close
                                                const botEdge = `L ${x1} ${botYs[i + 1]} C ${cpX} ${botYs[i + 1]}, ${cpX} ${botYs[i]}, ${x0} ${botYs[i]} Z`;
                                                return `${topEdge} ${botEdge}`;
                                            }

                                            // Full gradient outline path (top spine left→right, bot spine right→left)
                                            const topSpine = `M ${xs[0]} ${topYs[0]} ` +
                                                xs.slice(1).map((x, i) => {
                                                    const cpX = (xs[i] + x) / 2;
                                                    return `C ${cpX} ${topYs[i]}, ${cpX} ${topYs[i + 1]}, ${x} ${topYs[i + 1]}`;
                                                }).join(' ');
                                            const botSpine = xs.slice().reverse().map((x, ri) => {
                                                const i = n - ri;
                                                if (ri === 0) return `L ${x} ${botYs[i]}`;
                                                const cpX = (xs[i] + xs[i - 1]) / 2;
                                                return `C ${cpX} ${botYs[i]}, ${cpX} ${botYs[i - 1]}, ${xs[i - 1]} ${botYs[i - 1]}`;
                                            }).join(' ');
                                            const fullPath = `${topSpine} ${botSpine} Z`;

                                            return (
                                                <>
                                                    {/* Stage KPI numbers */}
                                                    <div className="flex justify-between mb-5 px-1">
                                                        {stages.map((s, i) => (
                                                            <div key={i} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
                                                                <p className="text-[22px] font-black tracking-tighter" style={{ color: s.color }}>{s.count.toLocaleString()}</p>
                                                                <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{s.label}</p>
                                                                {i > 0 && (
                                                                    <p className="text-[8px] font-black text-gray-200 mt-0.5">
                                                                        {stages[i - 1].count > 0
                                                                            ? Math.round((s.count / stages[i - 1].count) * 100)
                                                                            : 0}% conv.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* SVG Bézier Funnel */}
                                                    <div className="relative w-full" style={{ height: H }}>
                                                        <svg
                                                            viewBox={`0 0 ${W} ${H}`}
                                                            className="w-full h-full"
                                                            preserveAspectRatio="none"
                                                        >
                                                            <defs>
                                                                {/* Purple → teal gradient across full width */}
                                                                <linearGradient id="funnelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.85" />
                                                                    <stop offset="35%" stopColor="#60A5FA" stopOpacity="0.85" />
                                                                    <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.85" />
                                                                    <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.85" />
                                                                </linearGradient>
                                                                {/* Lighter version for per-segment hover */}
                                                                {stages.map((s, i) => (
                                                                    <linearGradient key={i} id={`segGrad${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                                        <stop offset="0%" stopColor={s.color} stopOpacity="0.95" />
                                                                        <stop offset="100%" stopColor={stages[Math.min(i + 1, n - 1)].color} stopOpacity="0.95" />
                                                                    </linearGradient>
                                                                ))}
                                                                {/* Gloss overlay */}
                                                                <linearGradient id="funnelGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                                                                    <stop offset="0%" stopColor="white" stopOpacity="0.20" />
                                                                    <stop offset="50%" stopColor="white" stopOpacity="0.04" />
                                                                    <stop offset="100%" stopColor="white" stopOpacity="0.12" />
                                                                </linearGradient>
                                                            </defs>

                                                            {/* 1. Main filled funnel shape with gradient */}
                                                            <path d={fullPath} fill="url(#funnelGrad)" />

                                                            {/* 2. Gloss layer on top */}
                                                            <path d={fullPath} fill="url(#funnelGloss)" />

                                                            {/* 3. Per-segment paths (slightly lighter on hover via opacity) */}
                                                            {stages.map((_, i) => (
                                                                <path
                                                                    key={i}
                                                                    d={segPath(i)}
                                                                    fill="transparent"
                                                                    stroke="white"
                                                                    strokeOpacity="0.15"
                                                                    strokeWidth="1.5"
                                                                    className="transition-opacity cursor-pointer hover:stroke-opacity-40"
                                                                />
                                                            ))}

                                                            {/* 4. Glassmorphic vertical dividers at each boundary */}
                                                            {xs.slice(1, -1).map((x, i) => (
                                                                <line
                                                                    key={i}
                                                                    x1={x} y1={topYs[i + 1]}
                                                                    x2={x} y2={botYs[i + 1]}
                                                                    stroke="white"
                                                                    strokeOpacity="0.25"
                                                                    strokeWidth="1.5"
                                                                    strokeDasharray="2 3"
                                                                />
                                                            ))}

                                                            {/* 5. Subtle flow particles */}
                                                            {[0.18, 0.45, 0.72].map((frac, i) => (
                                                                <circle
                                                                    key={i}
                                                                    cx={W * frac}
                                                                    cy={cy + (i % 2 === 0 ? -8 : 8)}
                                                                    r={i === 1 ? 3 : 2}
                                                                    fill="white"
                                                                    fillOpacity="0.3"
                                                                    className={i === 0 ? 'animate-ping' : i === 1 ? 'animate-pulse' : 'animate-bounce'}
                                                                />
                                                            ))}
                                                        </svg>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                                {/* Detailed Table Layer (Bottom): Granular Candidate Info */}
                                <div className="space-y-8">
                                    {/* Recent Applications Table - Full Width */}
                                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-all duration-300">
                                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/10">
                                            <h3 className="text-[17px] font-black text-[#1A2B3D]">Recent Applications</h3>
                                            <div className="flex gap-4">
                                                <button className="text-[10px] font-black uppercase text-gray-400 hover:text-[#1F7A6E] transition-colors flex items-center gap-1.5 bg-white border border-gray-100 px-4 py-2 rounded-xl shadow-sm">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0l-3.75-3.75M17.25 21L21 17.25" /></svg>
                                                    Filter
                                                </button>
                                                <button className="text-[10px] font-black uppercase text-gray-400 hover:text-[#1F7A6E] transition-colors flex items-center gap-1.5 bg-white border border-gray-100 px-4 py-2 rounded-xl shadow-sm">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    Export
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto flex-1">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-gray-50/30">
                                                        <th className="px-8 py-5 text-[10px] uppercase font-black text-gray-300 tracking-[0.15em]">Candidate Profile</th>
                                                        <th className="px-8 py-5 text-[10px] uppercase font-black text-gray-300 tracking-[0.15em]">Position Applied</th>
                                                        <th className="px-8 py-5 text-[10px] uppercase font-black text-gray-300 tracking-[0.15em]">Date Applied</th>
                                                        <th className="px-8 py-5 text-[10px] uppercase font-black text-gray-300 tracking-[0.15em]">Current Status</th>
                                                        <th className="px-8 py-5 text-[10px] uppercase font-black text-gray-300 tracking-[0.15em]">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50/50">
                                                    {(stats?.raw_data || []).slice(0, 8).map((app: any) => (
                                                        <tr key={app.id} className="hover:bg-gray-50/40 transition-colors group cursor-pointer" onClick={() => setDrawerApp(app)}>
                                                            <td className="px-8 py-5">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs uppercase shadow-sm">
                                                                        {app.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[14px] font-black text-[#1A2B3D] group-hover:text-[#1F7A6E] transition-colors">{app.name}</p>
                                                                        <p className="text-[11px] font-black text-gray-300 uppercase tracking-tight">{app.email}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-5 text-[13px] font-black text-gray-600">{app.job_title}</td>
                                                            <td className="px-8 py-5 text-[13px] font-black text-gray-400 capitalize">{new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                            <td className="px-8 py-5">
                                                                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit ${app.status === 'hired' ? 'bg-emerald-50 text-emerald-600' :
                                                                    app.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                                                        app.status === 'interview' ? 'bg-amber-50 text-amber-600' :
                                                                            app.status === 'offer' ? 'bg-indigo-50 text-indigo-600' :
                                                                                'bg-gray-100 text-gray-500'
                                                                    }`}>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${app.status === 'hired' ? 'bg-emerald-500' : app.status === 'rejected' ? 'bg-red-500' : 'bg-current opacity-40'}`} />
                                                                    {app.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-5">
                                                                <button className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-[#1F7A6E] hover:text-white">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!stats?.raw_data || stats.raw_data.length === 0) && (
                                                        <tr>
                                                            <td colSpan={5} className="px-8 py-20 text-center text-xs font-black text-gray-300 uppercase tracking-[0.2em]">No recent applications found</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Candidate Sources - Integrated as a secondary Bento row */}
                                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-8 flex flex-col hover:shadow-md transition-all duration-300">
                                        <div className="flex justify-between items-center mb-8">
                                            <div>
                                                <h3 className="text-[17px] font-black text-[#1A2B3D]">Candidate Sources</h3>
                                                <p className="text-[11px] font-black text-gray-300 uppercase mt-1 tracking-widest">Efficiency by channel</p>
                                            </div>
                                            <button
                                                onClick={() => setAddCandidateModal(true)}
                                                className="bg-emerald-50 text-[#1F7A6E] px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1F7A6E] hover:text-white transition-all shadow-sm shadow-emerald-100/50 flex items-center gap-2"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                                Add Manually
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-8">
                                            {stats?.sources?.slice(0, 6).map((src: any, i: number) => {
                                                const total = stats?.funnel?.applied || 1;
                                                const pct = Math.round((src.count / total) * 100);
                                                return (
                                                    <div key={i} className="bg-gray-50/30 p-5 rounded-2xl border border-gray-100/50 group/item hover:bg-white hover:border-emerald-100 transition-all">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className={`w-8 h-8 rounded-lg ${i === 0 ? 'bg-indigo-50 text-indigo-500' : i === 1 ? 'bg-amber-50 text-amber-500' : 'bg-white text-gray-300'} border border-gray-100 flex items-center justify-center font-black text-[10px]`}>
                                                                {i + 1}
                                                            </div>
                                                            <p className="text-[14px] font-black text-[#1A2B3D] tracking-tighter">{pct}%</p>
                                                        </div>
                                                        <p className="text-[11px] font-black text-gray-400 mb-3 uppercase tracking-widest">{src.source || 'Direct'}</p>
                                                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                            <div className={`h-full ${i === 0 ? 'bg-indigo-400' : i === 1 ? 'bg-amber-400' : 'bg-emerald-400'} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                        } {/* end statsLoading ternary */}
                    </div >
                )
            }


            {/* Requisition Detail Side Drawer */}
            <AnimatePresence>
                {drawerReq && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setDrawerReq(null)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-[120] flex flex-col"
                        >
                            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-[#1F7A6E] tracking-widest uppercase mb-1">REQ{drawerReq.id} Details</p>
                                    <h2 className="text-2xl font-black text-[#1A2B3D]">{drawerReq.title}</h2>
                                    <p className="text-gray-400 text-sm mt-1">{drawerReq.department} · {drawerReq.tenant?.name || user.tenant?.name || 'Droga Pharma'}</p>
                                </div>
                                <button onClick={() => setDrawerReq(null)} className="text-gray-300 hover:text-gray-500 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                <section className="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Status</p>
                                        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${drawerReq.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                            drawerReq.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                                            }`}>
                                            {drawerReq.status}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Requested By</p>
                                        <p className="text-sm font-bold text-[#1A2B3D]">{drawerReq.requester?.name || 'Hiring Manager'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Location / Branch</p>
                                        <p className="text-sm font-bold text-[#1A2B3D]">{drawerReq.location}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Priority</p>
                                        <p className="text-sm font-bold uppercase text-orange-500">{drawerReq.priority}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Budget Salary</p>
                                        <p className="text-sm font-black text-[#1A2B3D]">{drawerReq.budget ? drawerReq.budget.toLocaleString() : '15,000'} ETB /mo</p>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Description & Justification</h3>
                                        {drawerReq.jd_path && (
                                            <a
                                                href={`${API_URL}/v1/requisitions/${drawerReq.id}/jd?token=${typeof window !== 'undefined' ? localStorage.getItem('auth_token') : ''}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-[10px] font-black text-[#1F7A6E] hover:underline uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                View JD Document
                                            </a>
                                        )}
                                    </div>
                                    <div className="text-sm text-gray-600 leading-relaxed bg-white p-6 rounded border border-gray-100 italic">
                                        "{drawerReq.description || 'No detailed description provided.'}"
                                    </div>
                                </section>

                                {drawerReq.status === 'approved' && (
                                    <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-4">
                                        <div className="bg-emerald-500 text-white p-2 rounded-lg">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0114 0z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-[13px] font-black text-emerald-800 uppercase tracking-wide">Approved & Ready</h4>
                                            <p className="text-xs text-emerald-600 mt-1 leading-relaxed">This requisition has been signed off by HR. You can now publish it to the external careers portal.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Requisition Action Bar */}
                            <div className="p-8 border-t border-gray-100 bg-gray-50/30">
                                {drawerReq.status === 'approved' ? (
                                    <button
                                        onClick={() => handlePostJob(drawerReq)}
                                        disabled={actionLoading}
                                        className="w-full py-5 bg-[#1F7A6E] text-white rounded-lg text-[13px] font-black tracking-widest uppercase shadow-xl shadow-[#1F7A6E]/20 hover:bg-[#165C53] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {actionLoading ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                Post Job to Public Portal
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="w-full py-5 bg-gray-100 text-gray-300 rounded-lg text-[13px] font-black tracking-widest uppercase cursor-not-allowed"
                                    >
                                        Awaiting HR Approval
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Manually Add Candidate Modal */}
            <AnimatePresence>
                {addCandidateModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAddCandidateModal(false)} className="absolute inset-0 bg-[#1A2B3D]/40 backdrop-blur-sm" />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden relative z-10 border border-gray-100 flex flex-col max-h-[90vh]"
                        >
                            <div className="bg-[#F9FAFB] p-8 border-b border-gray-100 relative">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <svg className="w-16 h-16 text-[#1A2B3D]" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                                </div>
                                <h2 className="text-2xl font-black text-[#1A2B3D] flex items-center gap-3 relative z-10">
                                    <div className="w-2 h-8 bg-[#1F7A6E] rounded-full" />
                                    MANUAL SOURCING
                                </h2>
                                <p className="text-sm font-medium text-gray-500 mt-2 relative z-10">
                                    Directly add an applicant to the pipeline. Their source will be accurately tracked in reporting.
                                </p>
                            </div>
                            <div className="p-8 overflow-y-auto">
                                <form id="add-candidate-form" onSubmit={handleAddCandidate} className="space-y-6">
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Candidate Name <span className="text-red-500">*</span></label>
                                            <input required type="text" value={candidateForm.name} onChange={e => setCandidateForm({ ...candidateForm, name: e.target.value })} className="w-full bg-white border border-gray-200 text-sm font-bold text-[#1A2B3D] rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#1F7A6E] focus:ring-1 focus:ring-[#1F7A6E]" placeholder="ex. John Doe" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Email <span className="text-red-500">*</span></label>
                                            <input required type="email" value={candidateForm.email} onChange={e => setCandidateForm({ ...candidateForm, email: e.target.value })} className="w-full bg-white border border-gray-200 text-sm font-bold text-[#1A2B3D] rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#1F7A6E] focus:ring-1 focus:ring-[#1F7A6E]" placeholder="john@example.com" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone</label>
                                            <input type="tel" value={candidateForm.phone} onChange={e => setCandidateForm({ ...candidateForm, phone: e.target.value })} className="w-full bg-white border border-gray-200 text-sm font-bold text-[#1A2B3D] rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#1F7A6E] focus:ring-1 focus:ring-[#1F7A6E]" placeholder="+251 9..." />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Target Job / Open Role <span className="text-red-500">*</span></label>
                                            <select required value={candidateForm.job_posting_id} onChange={e => setCandidateForm({ ...candidateForm, job_posting_id: e.target.value })} className="w-full bg-white border border-gray-200 text-sm font-bold text-[#1A2B3D] rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#1F7A6E] focus:ring-1 focus:ring-[#1F7A6E]">
                                                <option value="" disabled>Select a target position...</option>
                                                {(jobs || []).filter(j => j.status === 'active').map(j => (
                                                    <option key={j.id} value={j.id}>{j.title} ({j.department})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black text-[#9B51E0] uppercase tracking-widest ml-1">Sourcing Channel <span className="text-red-500">*</span></label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {['LinkedIn', 'Referral', 'Website', 'Job Fair', 'Direct Outsourcing', 'Other'].map(src => (
                                                    <button
                                                        type="button"
                                                        key={src}
                                                        onClick={() => setCandidateForm({ ...candidateForm, source: src })}
                                                        className={`p-3 text-xs font-black uppercase tracking-widest rounded-xl border transition-all ${candidateForm.source === src ? 'bg-[#9B51E0]/10 border-[#9B51E0] text-[#9B51E0]' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200'
                                                            }`}
                                                    >
                                                        {src}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="p-8 bg-white border-t border-gray-100 flex gap-4 relative">
                                {candidateSuccess && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10 animate-in fade-in zoom-in duration-300">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <p className="text-sm font-black text-[#1A2B3D] uppercase tracking-widest">Candidate Added Successfully!</p>
                                        </div>
                                    </div>
                                )}
                                <button type="button" onClick={() => setAddCandidateModal(false)} className="px-6 py-4 flex-1 bg-gray-50 text-gray-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" form="add-candidate-form" disabled={actionLoading || candidateSuccess || !candidateForm.name || !candidateForm.email || !candidateForm.job_posting_id} className="px-6 py-4 flex-[2] bg-[#1A2B3D] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#1A2B3D]/90 disabled:opacity-50 transition-colors flex justify-center items-center shadow-lg shadow-[#1A2B3D]/20">
                                    {actionLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm & Add to Pipeline'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Applicant Detail Side Drawer */}
            <AnimatePresence>
                {drawerApp && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setDrawerApp(null)}
                            className="fixed inset-0 bg-[#1A2B3D]/40 backdrop-blur-sm z-[150]"
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-[160] flex flex-col"
                        >
                            <div className="flex-1 overflow-y-auto pb-10 flex flex-col">
                                {/* Premium Profile Header - Now Sticky & Inside Scrollable */}
                                <div className="sticky top-0 z-[70] h-64 bg-[#1A2B3D] flex items-center px-10 shrink-0">
                                    <div className="absolute inset-0 bg-gradient-to-br from-[#1F7A6E]/30 to-transparent opacity-40" />
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

                                    <button
                                        onClick={() => setDrawerApp(null)}
                                        className="absolute top-8 right-8 text-white/40 hover:text-white transition-all bg-white/5 hover:bg-white/10 p-2.5 rounded-xl backdrop-blur-md z-[80]"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>

                                    <div className="relative flex items-center gap-8 w-full">
                                        <div className="w-32 h-32 rounded-[36px] bg-white p-1 shadow-2xl overflow-hidden border-4 border-white/10 shrink-0">
                                            {drawerApp.photo_path ? (
                                                <img
                                                    src={drawerApp.photo_path.startsWith('http') ? drawerApp.photo_path : `${API_URL.replace('/api', '/storage')}/${drawerApp.photo_path}`}
                                                    alt={drawerApp.name}
                                                    className="w-full h-full object-cover rounded-[30px]"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-[#1F7A6E] to-[#165C53] rounded-[30px] flex items-center justify-center text-white text-4xl font-black shadow-inner">
                                                    {drawerApp.name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <h2 className="text-4xl font-black text-white leading-tight tracking-tight drop-shadow-sm">{drawerApp.name}</h2>
                                            <div className="inline-flex items-center gap-2 bg-[#1F7A6E] px-3 py-1 rounded-lg">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                <p className="text-white font-black text-[10px] uppercase tracking-widest">{drawerApp.job_posting?.title || 'Open Role'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-10 space-y-10 flex-1">
                                    {/* Enhanced Stat Grid */}
                                    <section className="grid grid-cols-3 gap-6 -mt-8 relative z-[75]">
                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 flex flex-col justify-center transform hover:scale-[1.02] transition-transform">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Experience</p>
                                            <p className="text-2xl font-black text-[#1A2B3D]">{drawerApp.years_of_experience ?? drawerApp.experience ?? 'N/A'} <span className="text-xs text-gray-400 font-bold uppercase ml-1">Years</span></p>
                                        </div>
                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 flex flex-col justify-center transform hover:scale-[1.02] transition-transform">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Match Score</p>
                                            <div className="flex items-center gap-2.5">
                                                <p className="text-2xl font-black text-[#1F7A6E]">{drawerApp.match_score || 88}%</p>
                                                <div className="flex-1 h-2 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                    <div className="h-full bg-gradient-to-r from-[#1F7A6E] to-[#2ecc71]" style={{ width: `${drawerApp.match_score || 88}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 flex flex-col justify-center transform hover:scale-[1.02] transition-transform">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Age / Gender</p>
                                            <p className="text-lg font-black text-[#1A2B3D]">{drawerApp.age || 'N/A'} <span className="text-gray-300 mx-1">•</span> {drawerApp.gender || 'N/A'}</p>
                                        </div>
                                    </section>

                                    {/* Detailed Info Cards */}
                                    <div className="grid grid-cols-2 gap-8">
                                        <section className="space-y-4">
                                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#1F7A6E]" />
                                                Candidate Profile
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center gap-4 hover:bg-white transition-colors">
                                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#1F7A6E]">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Email Address</p>
                                                        <p className="text-sm font-bold text-[#1A2B3D] truncate">{drawerApp.email}</p>
                                                    </div>
                                                </div>
                                                <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center gap-4 hover:bg-white transition-colors">
                                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#1F7A6E]">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                    </div>
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Phone Number</p>
                                                        <p className="text-sm font-bold text-[#1A2B3D] truncate">{drawerApp.phone || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="space-y-4">
                                            <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#1F7A6E]" />
                                                Professional Links
                                            </h3>
                                            <div className="space-y-3">
                                                {drawerApp.portfolio_link ? (
                                                    <a
                                                        href={drawerApp.portfolio_link}
                                                        target="_blank"
                                                        className="p-5 bg-[#1F7A6E]/5 rounded-2xl border border-[#1F7A6E]/10 flex items-center gap-4 hover:bg-[#1F7A6E]/10 transition-all group"
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-[#1F7A6E] flex items-center justify-center text-white shadow-lg shadow-[#1F7A6E]/20">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 019-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[10px] font-black text-[#1F7A6E] uppercase leading-none mb-1">Portfolio</p>
                                                            <p className="text-sm font-bold text-[#1A2B3D] group-hover:underline flex items-center gap-1">Visit Portfolio <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></p>
                                                        </div>
                                                    </a>
                                                ) : (
                                                    <div className="p-5 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-[11px] font-bold uppercase tracking-widest italic h-[116px]">
                                                        No Portfolio Provided
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </div>

                                    <section className="space-y-4">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#1F7A6E]" />
                                            Professional Background
                                        </h3>
                                        <div className="p-8 bg-gray-50/50 rounded-[32px] border border-gray-100 italic text-[#1A2B3D] leading-relaxed relative overflow-hidden group hover:bg-white hover:shadow-xl transition-all">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#1F7A6E]" />
                                            <div className="absolute top-4 left-4 text-6xl text-gray-200/50 select-none group-hover:text-[#1F7A6E]/10 transition-colors">“</div>
                                            <p className="relative z-10 pl-6 text-[15px] font-medium opacity-80">{drawerApp.professional_background || "No professional summary provided."}</p>
                                        </div>
                                    </section>

                                    {/* Supporting Documents */}
                                    <section className="space-y-4">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#1F7A6E]" />
                                            Supporting Documents
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="p-6 bg-white rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-[#1F7A6E]/20 hover:bg-gray-50/50 transition-all shadow-sm">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all shadow-inner">
                                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-[#1A2B3D] uppercase tracking-tighter">Professional Resume</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">PDF Document</p>
                                                    </div>
                                                </div>
                                                <a
                                                    href={`${API_URL}/v1/applicants/${drawerApp.id}/resume`}
                                                    target="_blank"
                                                    className="px-8 py-3 bg-white border-2 border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1A2B3D] hover:text-white hover:border-[#1A2B3D] transition-all shadow-sm"
                                                >
                                                    Open Document
                                                </a>
                                            </div>

                                            {drawerApp.attachments?.map((file: any, i: number) => (
                                                <div key={i} className="p-6 bg-white rounded-3xl border border-gray-100 flex items-center justify-between group hover:border-[#F7F8FA] hover:bg-[#F7F8FA] transition-all shadow-sm">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center group-hover:bg-[#1A2B3D] group-hover:text-white transition-all shadow-inner">
                                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-[#1A2B3D] uppercase tracking-tighter truncate max-w-[200px]">{file.label || 'Additional File'}</p>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{file.file_type?.toUpperCase() || 'FILE'}</p>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={`${API_URL}/v1/attachments/${file.id}/view`}
                                                        target="_blank"
                                                        className="px-8 py-3 bg-white border-2 border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1A2B3D] hover:text-white hover:border-[#1A2B3D] transition-all shadow-sm"
                                                    >
                                                        Open File
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Team Collaboration / Mentions */}
                                    <section className="space-y-4">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#1F7A6E]" />
                                            Team Collaboration
                                        </h3>
                                        <div className="bg-gray-50/50 rounded-3xl border border-gray-100 p-6 space-y-4">
                                            <p className="text-xs text-gray-500 font-medium">@Mention a manager to request review or leave interior feedback on this candidate.</p>

                                            <div className="flex gap-4">
                                                <select
                                                    value={mentionUser}
                                                    onChange={(e) => setMentionUser(e.target.value)}
                                                    className="w-1/3 bg-white border border-gray-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#1F7A6E] focus:ring-1 focus:ring-[#1F7A6E] font-medium"
                                                >
                                                    <option value="" disabled>Select Manager</option>
                                                    {departmentUsers.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                    ))}
                                                </select>

                                                <input
                                                    type="text"
                                                    value={mentionNote}
                                                    onChange={(e) => setMentionNote(e.target.value)}
                                                    placeholder="Type your message..."
                                                    className="flex-1 bg-white border border-gray-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#1F7A6E] focus:ring-1 focus:ring-[#1F7A6E]"
                                                />

                                                <button
                                                    onClick={handleSendMention}
                                                    disabled={mentionLoading || !mentionUser || !mentionNote.trim()}
                                                    className="px-6 bg-[#1A2B3D] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#1A2B3D]/90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-[#1A2B3D]/10"
                                                >
                                                    {mentionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'SEND'}
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {mentionSuccess && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -10 }}
                                                        className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700"
                                                    >
                                                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Success</p>
                                                            <p className="text-[11px] font-medium opacity-80">Message sent successfully.</p>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </section>
                                </div> {/* End of content padding */}
                            </div> {/* End of scrollable container */}

                            {/* Action Bar */}
                            <div className="p-8 border-t border-gray-100 bg-[#F9FAFB]/80 backdrop-blur-xl flex gap-5">
                                {drawerApp.status !== 'hired' && drawerApp.status !== 'rejected' && (
                                    <>
                                        {/* NEW / APPLIED → Move to Interview (Now opens Schedule Modal) */}
                                        {(drawerApp.status === 'applied' || drawerApp.status === 'new' || drawerApp.status === 'phone_screen') && (
                                            <button
                                                onClick={() => {
                                                    // Auto-select first department user as default interviewer
                                                    if (departmentUsers.length > 0) {
                                                        setScheduleForm(p => ({ ...p, interviewer_id: departmentUsers[0].id }));
                                                    }
                                                    setScheduleModal(true);
                                                }}
                                                disabled={actionLoading}
                                                className="flex-1 py-5 bg-gradient-to-r from-[#1F7A6E] to-[#165C53] text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-[#1F7A6E]/30 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
                                            >
                                                {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : '📅 Schedule Interview'}
                                            </button>
                                        )}

                                        {/* INTERVIEW → Send Offer Letter (opens modal) */}
                                        {drawerApp.status === 'interview' && (
                                            <button
                                                onClick={() => setOfferModal(true)}
                                                disabled={actionLoading}
                                                className="flex-1 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
                                            >
                                                ✉️ Send Offer Letter
                                            </button>
                                        )}

                                        {/* OFFER → Hire Candidate */}
                                        {drawerApp.status === 'offer' && (
                                            <button
                                                onClick={() => handleStatusUpdate(drawerApp.id, 'hired')}
                                                disabled={actionLoading}
                                                className="flex-1 py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
                                            >
                                                {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : '🏆 Confirm Hire'}
                                            </button>
                                        )}

                                        {/* Reject always visible (unless already final) */}
                                        <button
                                            onClick={() => handleStatusUpdate(drawerApp.id, 'rejected')}
                                            disabled={actionLoading}
                                            className="flex-1 py-5 bg-white text-red-500 border-2 border-red-50 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-red-50 hover:border-red-100 transition-all"
                                        >
                                            {actionLoading ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin mx-auto" /> : '✕ Reject'}
                                        </button>
                                    </>
                                )}
                                {drawerApp.status === 'hired' && (
                                    <div className="flex-1 py-4 bg-emerald-50 text-emerald-600 rounded-2xl text-center font-black text-[10px] uppercase tracking-widest border border-emerald-100">
                                        🏆 Active Employee
                                    </div>
                                )}
                                {drawerApp.status === 'rejected' && (
                                    <div className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl text-center font-black text-[10px] uppercase tracking-widest border border-red-100">
                                        Application Closed (Rejected)
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Offer Letter Modal */}
            <AnimatePresence>
                {offerModal && drawerApp && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-6"
                        style={{ background: 'rgba(26,43,61,0.6)', backdropFilter: 'blur(8px)' }}
                        onClick={() => setOfferModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-8">
                                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Next Step</p>
                                <h3 className="text-2xl font-black text-white">Send Offer Letter</h3>
                                <p className="text-sm text-white/80 mt-1">to {drawerApp.name} · {drawerApp.email}</p>
                            </div>

                            {/* Modal Body */}
                            <div className="p-8 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Offered Salary <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ETB 45,000 / month or $3,500 / month"
                                        value={offerForm.salary}
                                        onChange={e => setOfferForm(p => ({ ...p, salary: e.target.value }))}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-amber-400 focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Proposed Start Date</label>
                                    <input
                                        type="date"
                                        value={offerForm.startDate}
                                        onChange={e => setOfferForm(p => ({ ...p, startDate: e.target.value }))}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-amber-400 focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Additional Notes (optional)</label>
                                    <textarea
                                        rows={3}
                                        placeholder="e.g. signing bonus, remote work policy, probation period..."
                                        value={offerForm.notes}
                                        onChange={e => setOfferForm(p => ({ ...p, notes: e.target.value }))}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-amber-400 focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors resize-none"
                                    />
                                </div>

                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-[12px] text-amber-700 font-medium">
                                    📧 A professional offer letter will be emailed directly to <strong>{drawerApp.email}</strong> with all the details above.
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="px-8 pb-8 flex gap-4">
                                <button
                                    onClick={() => setOfferModal(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendOffer}
                                    disabled={actionLoading || !offerForm.salary.trim()}
                                    className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : '✉️ Send Offer Letter'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Schedule Interview Modal */}
            <AnimatePresence>
                {scheduleModal && drawerApp && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-6"
                        style={{ background: 'rgba(26,43,61,0.6)', backdropFilter: 'blur(8px)' }}
                        onClick={() => setScheduleModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 20 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-[#1F7A6E] to-[#165C53] p-8 shrink-0">
                                <p className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Schedule Stage</p>
                                <h3 className="text-2xl font-black text-white">Schedule Interview</h3>
                                <p className="text-sm text-white/80 mt-1">with {drawerApp.name} · {drawerApp.job_posting?.title || 'Open Role'}</p>
                            </div>

                            {/* Modal Body (Scrollable if needed) */}
                            <div className="p-8 space-y-6 overflow-y-auto flex-1">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Date <span className="text-red-400">*</span></label>
                                        <input
                                            type="date"
                                            value={scheduleForm.date}
                                            onChange={e => setScheduleForm(p => ({ ...p, date: e.target.value }))}
                                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Time <span className="text-red-400">*</span></label>
                                        <input
                                            type="time"
                                            value={scheduleForm.time}
                                            onChange={e => setScheduleForm(p => ({ ...p, time: e.target.value }))}
                                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Format <span className="text-red-400">*</span></label>
                                        <select
                                            value={scheduleForm.type}
                                            onChange={e => setScheduleForm(p => ({ ...p, type: e.target.value }))}
                                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                        >
                                            <option value="video">Video Call</option>
                                            <option value="phone">Phone Screen</option>
                                            <option value="in-person">In-Person</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Location / Link</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Google Meet link or HQ Address"
                                            value={scheduleForm.location}
                                            onChange={e => setScheduleForm(p => ({ ...p, location: e.target.value }))}
                                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Interviewer <span className="text-red-400">*</span></label>
                                    <select
                                        value={scheduleForm.interviewer_id}
                                        onChange={e => setScheduleForm(p => ({ ...p, interviewer_id: e.target.value }))}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                    >
                                        <option value="" disabled>Select Interviewer</option>
                                        {departmentUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Custom Message to Candidate</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Add instructions, details about the format, what to prepare, etc."
                                        value={scheduleForm.message}
                                        onChange={e => setScheduleForm(p => ({ ...p, message: e.target.value }))}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors resize-none"
                                    />
                                </div>

                                <div className="bg-[#1F7A6E]/5 border border-[#1F7A6E]/20 rounded-2xl p-4 text-[12px] text-[#1F7A6E] font-medium flex gap-3">
                                    <span className="text-base text-xl leading-none">📧</span>
                                    <p>An official interview invitation will be emailed to <strong>{drawerApp.email}</strong> and the selected interviewer immediately. They will also receive a 24-hour reminder before the scheduled time.</p>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="px-8 pb-8 shrink-0 flex gap-4 pt-4 bg-white border-t border-gray-50">
                                <button
                                    onClick={() => setScheduleModal(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleScheduleInterview}
                                    disabled={actionLoading || !scheduleForm.date || !scheduleForm.time || !scheduleForm.interviewer_id}
                                    className="flex-[2] py-4 bg-gradient-to-r from-[#1F7A6E] to-[#165C53] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#1F7A6E]/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : '📅 Schedule & Send Invites'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Employee Status Modal */}
            <AnimatePresence>
                {employeeStatusModal && selectedEmployee && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1A2B3D]/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            <div className="px-8 pt-8 pb-6 bg-[#F9FAFB] border-b border-gray-100 flex justify-between items-center shrink-0">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-[#1A2B3D] tracking-tight">MANAGE STATUS</h2>
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Update employment for {selectedEmployee.name}</p>
                                </div>
                                <button onClick={() => setEmployeeStatusModal(false)} className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-8 space-y-6 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">New Status</label>
                                        <select
                                            value={employeeStatusForm.status}
                                            onChange={e => setEmployeeStatusForm({ ...employeeStatusForm, status: e.target.value })}
                                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                        >
                                            <option value="active">Active</option>
                                            <option value="resigned">Resigned</option>
                                            <option value="terminated">Terminated</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Date of Separation</label>
                                        <input
                                            type="date"
                                            value={employeeStatusForm.date}
                                            onChange={e => setEmployeeStatusForm({ ...employeeStatusForm, date: e.target.value })}
                                            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors"
                                            disabled={employeeStatusForm.status === 'active'}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Reason (Internal Note)</label>
                                    <textarea
                                        rows={4}
                                        value={employeeStatusForm.reason}
                                        onChange={e => setEmployeeStatusForm({ ...employeeStatusForm, reason: e.target.value })}
                                        placeholder="Briefly describe the reason for separation..."
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-100 focus:border-[#1F7A6E] focus:outline-none text-[#1A2B3D] font-bold text-sm transition-colors resize-none"
                                        disabled={employeeStatusForm.status === 'active'}
                                    />
                                </div>

                                {employeeStatusForm.status !== 'active' && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-[12px] text-amber-600 font-medium flex gap-3">
                                        <span className="text-base text-xl leading-none">⚠️</span>
                                        <p>Warning: Marking an employee as {employeeStatusForm.status} will remove them from the active list and it will immediately affect the <strong>Employee Turnover Report</strong>.</p>
                                    </div>
                                )}
                            </div>

                            <div className="px-8 pb-8 shrink-0 flex gap-4 pt-4 bg-white border-t border-gray-50">
                                <button
                                    onClick={() => setEmployeeStatusModal(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateEmployeeStatus}
                                    disabled={actionLoading}
                                    className="flex-[2] py-4 bg-gradient-to-r from-[#1F7A6E] to-[#165C53] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#1F7A6E]/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Confirm Status Update'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
