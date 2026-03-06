'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch, API_URL } from '@/lib/api';

interface Requisition {
    id: number;
    title: string;
    department: string;
    headcount: number;
    budget: number | null;
    position_type: 'new' | 'replacement';
    priority: string;
    location: string;
    status: string;
    description: string | null;
    jd_path: string | null; // Added field
    created_at: string;
    requester?: { id: number; name: string; email: string };
    tenant?: { name: string };
    job_posting?: { created_at: string; title: string; id: number };
}

export default function HRManagerDashboard({ user, activeTab: initialTab, onLogout }: { user: any; activeTab: string; onLogout: () => void }) {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [reqsMeta, setReqsMeta] = useState<any>(null);
    const [reqsPage, setReqsPage] = useState(1);
    const [jobs, setJobs] = useState<any[]>([]);
    const [jobsMeta, setJobsMeta] = useState<any>(null);
    const [jobsPage, setJobsPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [drawerReq, setDrawerReq] = useState<Requisition | null>(null);
    const [rejectTarget, setRejectTarget] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [localTab, setLocalTab] = useState(initialTab === 'HiringPlan' ? 'HIRING PLAN' : 'JOBS');
    const [stats, setStats] = useState<any>(null);
    const [reportFilters, setReportFilters] = useState({ dateRange: '30', department: 'All', jobId: 'All' });

    const fetchData = async () => {
        try {
            const [reqsJson, jobsJson] = await Promise.all([
                apiFetch(`/v1/requisitions?page=${reqsPage}`),
                apiFetch(`/v1/jobs?page=${jobsPage}`)
            ]);
            setRequisitions(reqsJson.data || []);
            setReqsMeta(reqsJson);
            setJobs(jobsJson.data || []);
            setJobsMeta(jobsJson);

            if (localTab === 'REPORTS') {
                const params = new URLSearchParams({
                    date_range: reportFilters.dateRange,
                    department: reportFilters.department,
                    job_id: reportFilters.jobId
                });
                const statsData = await apiFetch(`/v1/applicants/stats?${params.toString()}`);
                setStats(statsData);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [localTab, reportFilters, reqsPage, jobsPage]);

    const handleApprove = async (id: number) => {
        setActionLoading(true);
        try {
            await apiFetch(`/v1/requisitions/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'approved' }),
            });
            setDrawerReq(null);
            fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) return;
        setActionLoading(true);
        try {
            await apiFetch(`/v1/requisitions/${rejectTarget}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'rejected', rejection_reason: rejectReason }),
            });
            setRejectTarget(null);
            setRejectReason('');
            setDrawerReq(null);
            fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const handleBulkApprove = async () => {
        if (selectedIds.length === 0) return;
        setActionLoading(true);
        try {
            await apiFetch('/v1/requisitions/bulk-approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds }),
            });
            setSelectedIds([]);
            fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    const pendingReqs = requisitions.filter(r => r.status === 'pending');

    return (
        <div className="space-y-6 pb-20">
            {/* Page Header */}
            <div className="flex justify-between items-end mb-4">
                <div className="space-y-4">
                    <h1 className="text-[32px] font-bold text-[#1A2B3D] tracking-tight">{user.tenant?.name || 'Droga Pharma'}</h1>

                    {/* Sub Tabs */}
                    <div className="flex gap-8 border-b border-gray-100">
                        {['JOBS', 'HIRING PLAN', 'REPORTS'].map((t) => (
                            <button
                                key={t}
                                onClick={() => setLocalTab(t)}
                                className={`pb-3 text-[13px] font-black tracking-widest transition-all relative ${localTab === t ? 'text-[#1A2B3D]' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {t}
                                {localTab === t && (
                                    <motion.div
                                        layoutId="activeSubTabHR"
                                        className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1F7A6E]"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {localTab === 'HIRING PLAN' && selectedIds.length > 0 && (
                    <button
                        onClick={handleBulkApprove}
                        disabled={actionLoading}
                        className="bg-[#1F7A6E] hover:bg-[#165C53] text-white px-6 py-3 rounded font-black text-[13px] tracking-wide shadow-xl shadow-[#1F7A6E]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        Approve Selected ({selectedIds.length})
                    </button>
                )}
            </div>

            {/* Content Body */}
            {loading ? (
                <div className="bg-white rounded border border-gray-100 p-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[#1F7A6E] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden">
                    {localTab === 'JOBS' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#F9FAFB] border-b border-gray-100">
                                    <tr>
                                        {['Position', 'Department', 'Location', 'Status', 'Applicants'].map(h => (
                                            <th key={h} className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {jobs.length === 0 ? (
                                        <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic text-sm">No jobs posted yet.</td></tr>
                                    ) : jobs.map((job) => (
                                        <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-6 font-black text-[13px] text-[#1A2B3D]">{job.title}</td>
                                            <td className="px-6 py-6 text-[13px] text-gray-600">{job.department || job.requisition?.department || '—'}</td>
                                            <td className="px-6 py-6 text-[13px] text-gray-600">{job.location || '—'}</td>
                                            <td className="px-6 py-6">
                                                <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                                                    {job.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6 text-[13px] font-black text-[#1A2B3D]">
                                                {job.applicants_count ?? 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {jobsMeta?.last_page > 1 && (
                                <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                        Page {jobsPage} of {jobsMeta.last_page}
                                    </span>
                                    <div className="flex gap-2">
                                        <button disabled={jobsPage === 1} onClick={() => setJobsPage(p => p - 1)} className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-30">←</button>
                                        <button disabled={jobsPage === jobsMeta.last_page} onClick={() => setJobsPage(p => p + 1)} className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-30">→</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {localTab === 'HIRING PLAN' && (
                        <table className="w-full text-left">
                            <thead className="bg-[#F9FAFB] border-b border-gray-100">
                                <tr>
                                    <th className="pl-6 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => setSelectedIds(e.target.checked ? pendingReqs.map(r => r.id) : [])}
                                            checked={pendingReqs.length > 0 && selectedIds.length === pendingReqs.length}
                                            className="accent-[#1F7A6E] rounded"
                                        />
                                    </th>
                                    {['REQUISITION', 'COMPANY', 'HIRING MANAGER', 'LOCATION', 'SALARY', 'SUBMITTED ON', 'POSTED TO PORTAL', 'STATUS'].map(h => (
                                        <th key={h} className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {requisitions.length === 0 ? (
                                    <tr><td colSpan={9} className="px-8 py-20 text-center text-gray-400 italic text-sm">No requisitions in the plan.</td></tr>
                                ) : requisitions.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                                        <td className="pl-6 py-6" onClick={(e) => e.stopPropagation()}>
                                            {req.status === 'pending' && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(req.id)}
                                                    onChange={(e) => setSelectedIds(prev => e.target.checked ? [...prev, req.id] : prev.filter(id => id !== req.id))}
                                                    className="accent-[#1F7A6E] rounded"
                                                />
                                            )}
                                        </td>
                                        <td className="px-6 py-6" onClick={() => setDrawerReq(req)}>
                                            <p className="font-black text-[13px] text-[#0066CC] hover:underline group-hover:text-[#1F7A6E]">
                                                REQ{req.id} {req.title}
                                            </p>
                                            <p className="text-[11px] text-gray-400 mt-0.5 tracking-tight">
                                                {req.department}
                                            </p>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-1 rounded">
                                                {req.tenant?.name || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-[13px] text-gray-600">
                                            {req.requester?.name || 'Hiring Manager'}
                                        </td>
                                        <td className="px-6 py-6 text-[13px] text-gray-600">
                                            {req.location || '—'}
                                        </td>
                                        <td className="px-6 py-6 text-[13px] text-[#1A2B3D] font-black">
                                            {req.budget ? req.budget.toLocaleString() : '15,000'} ETB /mo
                                        </td>
                                        <td className="px-6 py-6">
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
                                        <td className="px-6 py-6">
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
                                        <td className="px-6 py-6">
                                            {req.status === 'pending' ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleApprove(req.id); }}
                                                        className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 uppercase"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setRejectTarget(req.id); setRejectReason(''); setDrawerReq(req); }}
                                                        className="text-[10px] font-black text-red-500 bg-red-50 px-3 py-1.5 rounded hover:bg-red-500 hover:text-white transition-all border border-red-100 uppercase"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                                                    }`}>
                                                    {req.status}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {localTab === 'REPORTS' && (
                        <div className="p-10 space-y-10">
                            {/* Filter Bar */}
                            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between sticky top-0 z-10">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">📅</div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Timeframe</p>
                                            <select
                                                value={reportFilters.dateRange}
                                                onChange={e => setReportFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                                                className="text-sm font-bold text-[#1A2B3D] bg-transparent outline-none cursor-pointer"
                                            >
                                                <option value="7">Last 7 Days</option>
                                                <option value="30">Last 30 Days</option>
                                                <option value="90">Last 90 Days</option>
                                                <option value="All">All Time</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100" />
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">🏢</div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Department</p>
                                            <select
                                                value={reportFilters.department}
                                                onChange={e => setReportFilters(prev => ({ ...prev, department: e.target.value }))}
                                                className="text-sm font-bold text-[#1A2B3D] bg-transparent outline-none cursor-pointer"
                                            >
                                                <option value="All">All Departments</option>
                                                {[...new Set(jobs.map(j => j.department || j.requisition?.department).filter(Boolean))].map(dept => (
                                                    <option key={String(dept)} value={String(dept)}>{String(dept)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-gray-100" />
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">💼</div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Specific Role</p>
                                            <select
                                                value={reportFilters.jobId}
                                                onChange={e => setReportFilters(prev => ({ ...prev, jobId: e.target.value }))}
                                                className="text-sm font-bold text-[#1A2B3D] bg-transparent outline-none cursor-pointer w-48 truncate"
                                            >
                                                <option value="All">All Open Roles</option>
                                                {jobs.map(job => (
                                                    <option key={job.id} value={job.id}>{job.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button onClick={() => fetchData()} className="px-4 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors">
                                        ↻ Refresh
                                    </button>
                                    <button
                                        onClick={() => {
                                            const params = new URLSearchParams({
                                                date_range: reportFilters.dateRange,
                                                department: reportFilters.department,
                                                job_id: reportFilters.jobId
                                            });
                                            const token = localStorage.getItem('auth_token');
                                            const exportUrl = `${process.env.NEXT_PUBLIC_API_URL}/v1/applicants/export?${params.toString()}&token=${token}`;
                                            window.open(exportUrl, '_blank');
                                        }}
                                        className="px-4 py-2 bg-[#1A2B3D] text-white rounded-lg text-xs font-bold hover:bg-[#1A2B3D]/90 transition-colors shadow-lg shadow-[#1A2B3D]/20"
                                    >
                                        Export CSV
                                    </button>
                                </div>
                            </div>

                            {/* Stat Grid */}
                            <div className="grid grid-cols-4 gap-6">
                                {[
                                    { label: 'Total Placements', value: stats?.funnel?.hired || 0, icon: '🏆', color: 'emerald' },
                                    { label: 'Active Pipeline', value: (stats?.funnel?.applied || 0) - (stats?.funnel?.hired || 0) - (stats?.funnel?.rejected || 0), icon: '🔥', color: 'blue' },
                                    { label: 'Pending Reqs', value: stats?.requisitions?.pending || 0, icon: '⏳', color: 'amber' },
                                    { label: 'Success Rate', value: stats?.funnel?.applied > 0 ? Math.round((stats.funnel.hired / stats.funnel.applied) * 100) + '%' : '0%', icon: '📈', color: 'indigo' },
                                ].map((stat, i) => (
                                    <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl shadow-gray-200/20 hover:scale-[1.02] transition-transform group">
                                        <div className={`w-12 h-12 rounded-2xl bg-${stat.color}-50 flex items-center justify-center text-xl mb-4 group-hover:rotate-12 transition-transform`}>{stat.icon}</div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                        <p className="text-3xl font-black text-[#1A2B3D]">{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Side Drawer Integration */}
            <AnimatePresence>
                {drawerReq && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => { setDrawerReq(null); setRejectTarget(null); }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-[120] overflow-y-auto"
                        >
                            <div className="p-8 border-b border-gray-100 flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-black text-[#1F7A6E] tracking-widest uppercase mb-1">REQ{drawerReq.id}</p>
                                    <h2 className="text-2xl font-black text-[#1A2B3D]">{drawerReq.title}</h2>
                                    <p className="text-gray-400 text-sm mt-1">{drawerReq.department} · {drawerReq.tenant?.name || user.tenant?.name || 'Droga Pharma'}</p>
                                </div>
                                <button onClick={() => { setDrawerReq(null); setRejectTarget(null); }} className="text-gray-300 hover:text-gray-500 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="p-8 space-y-8">
                                <div className="grid grid-cols-2 gap-6 pb-8 border-b border-gray-100">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Location / Branch</p>
                                        <p className="text-sm font-bold text-[#1A2B3D]">{drawerReq.location}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Salary Range</p>
                                        <p className="text-sm font-black text-[#1A2B3D]">{drawerReq.budget ? drawerReq.budget.toLocaleString() : '15,000'} ETB /mo</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Justification / Description</h3>
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
                                    <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded border border-gray-100 border-dashed">
                                        {drawerReq.description || 'No detailed description provided for this requisition.'}
                                    </p>
                                </div>

                                {drawerReq.status === 'pending' && (
                                    <div className="pt-8 space-y-4 border-t border-gray-100">
                                        {rejectTarget === drawerReq.id ? (
                                            <div className="space-y-3">
                                                <textarea
                                                    value={rejectReason}
                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                    placeholder="Enter rejection reason..."
                                                    className="w-full px-4 py-3 bg-red-50/50 border border-red-100 rounded focus:ring-2 focus:ring-red-200 outline-none text-sm h-32"
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => setRejectTarget(null)} className="flex-1 px-6 py-3 bg-gray-50 text-gray-400 rounded text-[11px] font-black tracking-widest uppercase mb-4">Cancel</button>
                                                    <button
                                                        onClick={handleReject}
                                                        disabled={!rejectReason.trim() || actionLoading}
                                                        className="flex-[2] px-6 py-3 bg-red-500 text-white rounded text-[11px] font-black tracking-widest uppercase mb-4 disabled:opacity-50"
                                                    >
                                                        Confirm Rejection
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => handleApprove(drawerReq.id)}
                                                    disabled={actionLoading}
                                                    className="flex-1 px-6 py-4 bg-[#1F7A6E] text-white rounded text-[11px] font-black tracking-widest uppercase shadow-xl shadow-[#1F7A6E]/20"
                                                >
                                                    Approve Requisition
                                                </button>
                                                <button
                                                    onClick={() => setRejectTarget(drawerReq.id)}
                                                    className="px-6 py-4 bg-red-50 text-red-500 rounded text-[11px] font-black tracking-widest uppercase border border-red-100 hover:bg-red-500 hover:text-white transition-all"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
