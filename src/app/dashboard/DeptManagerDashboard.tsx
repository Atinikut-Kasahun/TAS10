'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/api';

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
    created_at: string;
}

const INITIAL_FORM_DATA = {
    title: '',
    department: '',
    location: '',
    headcount: 1,
    priority: 'medium',
    budget: 0,
    position_type: 'new',
    description: '',
};

export default function DeptManagerDashboard({ user, activeTab: initialTab, onLogout }: { user: any; activeTab: string; onLogout: () => void }) {
    const [requisitions, setRequisitions] = useState<Requisition[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [jdFile, setJdFile] = useState<File | null>(null); // New state for file
    const [submitting, setSubmitting] = useState(false);
    const [jobs, setJobs] = useState<any[] | null>(null);
    const [jobsMeta, setJobsMeta] = useState<any>(null);
    const [reqsMeta, setReqsMeta] = useState<any>(null);
    const [jobsPage, setJobsPage] = useState(1);
    const [reqsPage, setReqsPage] = useState(1);
    const [localTab, setLocalTab] = useState(initialTab === 'HiringPlan' ? 'HIRING PLAN' : 'JOBS');
    const [search, setSearch] = useState(''); // live search term from URL
    const router = useRouter();

    useEffect(() => {
        setLoading(true);
        setJobs(null);
        setRequisitions(null);
        setLocalTab(initialTab === 'HiringPlan' ? 'HIRING PLAN' : 'JOBS');
        fetchData();
    }, [initialTab]);

    useEffect(() => {
        // Poll URL for live search changes written by Navbar
        const interval = setInterval(() => {
            const params = new URLSearchParams(window.location.search);
            const s = params.get('search') ?? '';
            setSearch(prev => {
                const updated = prev !== s ? s : prev;
                if (prev !== s) console.log('[DM Dashboard] Search updated:', s);
                return updated;
            });
        }, 200);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async (jp = jobsPage, rp = reqsPage) => {
        try {
            const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
            console.log('[DM Dashboard] Fetching data with search:', search || '(none)');
            const [reqRes, jobsRes] = await Promise.all([
                apiFetch(`/v1/requisitions?page=${rp}${searchParam}`),
                apiFetch(`/v1/jobs?page=${jp}${searchParam}`)
            ]);
            setRequisitions(reqRes.data || []);
            setReqsMeta(reqRes);
            setJobs(jobsRes.data || []);
            setJobsMeta(jobsRes);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(jobsPage, reqsPage); }, [jobsPage, reqsPage, search]);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const fd = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                fd.append(key, value.toString());
            });
            if (jdFile) {
                fd.append('jd_file', jdFile);
            }

            await apiFetch('/v1/requisitions', {
                method: 'POST',
                // Note: when using FormData, do NOT set Content-Type header
                body: fd,
            });
            setDrawerOpen(false);
            setWizardStep(1);
            setFormData(INITIAL_FORM_DATA);
            setJdFile(null); // Clear file after submission
            fetchData();
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDuplicate = async (id: number) => {
        try {
            await apiFetch(`/v1/requisitions/${id}/duplicate`, { method: 'POST' });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Page Header */}
            <div className="flex justify-between items-end mb-4">
                <div className="space-y-4">
                    <h1 className="text-[32px] font-bold text-[#1A2B3D] tracking-tight">{user.tenant?.name || 'Droga Pharma'}</h1>

                    {/* Sub Tabs */}
                    <div className="flex gap-10 border-b border-gray-100 mt-2">
                        {['JOBS', 'HIRING PLAN'].map((t) => {
                            const isSectionActive = (t === 'JOBS' && initialTab === 'Jobs') || (t === 'HIRING PLAN' && initialTab === 'HiringPlan');
                            const isSubActive = localTab === t;
                            const isActive = isSectionActive || isSubActive;

                            return (
                                <button
                                    key={t}
                                    onClick={() => {
                                        if (t === 'JOBS' && initialTab !== 'Jobs') {
                                            router.push('/dashboard?tab=Jobs');
                                        } else if (t === 'HIRING PLAN' && initialTab !== 'HiringPlan') {
                                            router.push('/dashboard?tab=HiringPlan');
                                        } else {
                                            setLocalTab(t);
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
                                            layoutId="activeSubTabDM"
                                            className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#1F7A6E] rounded-t-full"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {localTab === 'HIRING PLAN' && (
                    <button
                        onClick={() => setDrawerOpen(true)}
                        className="bg-[#1F7A6E] hover:bg-[#165C53] text-white px-6 py-3 rounded font-black text-[13px] tracking-wide shadow-xl shadow-[#1F7A6E]/20 transition-all flex items-center gap-2"
                    >
                        Create new requisition
                    </button>
                )}
            </div>

            {/* Content Body */}
            {loading ? (
                <div className="bg-white rounded border border-gray-100 p-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-[#1F7A6E] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                    {localTab === 'JOBS' && (
                        <>
                            <table className="w-full text-left">
                                <thead className="bg-[#F9FAFB] border-b border-gray-100">
                                    <tr>
                                        {['POSITION', 'LOCATION', 'DEPARTMENT', 'STATUS', 'POSTED ON'].map(h => (
                                            <th key={h} className="px-8 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {jobs === null ? null : jobs.length === 0 ? (
                                        <tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic text-sm">No active jobs posted yet for {user.tenant?.name || 'this company'}.</td></tr>
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
                                            <td className="px-8 py-6 text-[13px] text-gray-600">
                                                {new Date(job.created_at).toLocaleDateString()}
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
                                        <button
                                            disabled={jobsPage === 1}
                                            onClick={() => setJobsPage(p => p - 1)}
                                            className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-30"
                                        >
                                            ←
                                        </button>
                                        <button
                                            disabled={jobsPage === jobsMeta.last_page}
                                            onClick={() => setJobsPage(p => p + 1)}
                                            className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-30"
                                        >
                                            →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {localTab === 'HIRING PLAN' && (
                        <>
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
                                        <tr><td colSpan={7} className="px-8 py-20 text-center text-gray-400 italic text-sm">No requisitions created yet for {user.tenant?.name || 'this company'}.</td></tr>
                                    ) : requisitions.map((req: any) => (
                                        <tr key={req.id} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                                            <td className="px-8 py-6">
                                                <p className="font-black text-[13px] text-[#0066CC] hover:underline group-hover:text-[#1F7A6E]">
                                                    REQ{req.id} {req.title}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5 tracking-tight">
                                                    {req.department} · {req.position_type === 'replacement' ? '↺ Replacement' : '✦ New'}
                                                </p>
                                            </td>
                                            <td className="px-8 py-6 text-[13px] text-gray-600">
                                                {user.name} (You)
                                            </td>
                                            <td className="px-8 py-6 text-[13px] text-gray-600">
                                                {req.location || '—'}
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
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                                        req.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                                                        }`}>
                                                        {req.status}
                                                    </span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDuplicate(req.id); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-[#1F7A6E] transition-all"
                                                        title="Duplicate"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {reqsMeta?.last_page > 1 && (
                                <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                                        Page {reqsPage} of {reqsMeta.last_page}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={reqsPage === 1}
                                            onClick={() => setReqsPage(p => p - 1)}
                                            className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-30"
                                        >
                                            ←
                                        </button>
                                        <button
                                            disabled={reqsPage === reqsMeta.last_page}
                                            onClick={() => setReqsPage(p => p + 1)}
                                            className="w-8 h-8 rounded border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-30"
                                        >
                                            →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Creation Wizard Side Drawer */}
            <AnimatePresence>
                {drawerOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setDrawerOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110]"
                        />
                        <motion.div
                            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white shadow-2xl z-[120] flex flex-col"
                        >
                            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-black text-[#1A2B3D]">New Requisition</h2>
                                    <div className="flex items-center gap-2 mt-2">
                                        <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#1F7A6E] transition-all duration-500" style={{ width: wizardStep === 1 ? '50%' : '100%' }} />
                                        </div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Step {wizardStep} of 2</span>
                                    </div>
                                </div>
                                <button onClick={() => setDrawerOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                {wizardStep === 1 ? (
                                    <div className="space-y-6">
                                        <section className="space-y-4">
                                            <h3 className="text-[11px] font-black text-[#1F7A6E] uppercase tracking-widest">Job Details</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Job Title</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-4 focus:ring-[#1F7A6E]/10 focus:border-[#1F7A6E] transition-all text-sm font-bold text-[#1A2B3D]"
                                                        placeholder="e.g. Senior Pharmacist"
                                                        value={formData.title}
                                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Department</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-4 focus:ring-[#1F7A6E]/10 focus:border-[#1F7A6E] transition-all text-sm font-bold text-[#1A2B3D]"
                                                        placeholder="e.g. Sales & Marketing"
                                                        value={formData.department}
                                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Location / Branch</label>
                                                    <input
                                                        type="text"
                                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-4 focus:ring-[#1F7A6E]/10 focus:border-[#1F7A6E] transition-all text-sm font-bold text-[#1A2B3D]"
                                                        placeholder="e.g. Arat Kilo, Bole, or Regional"
                                                        value={formData.location}
                                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </section>

                                        <section className="space-y-4 pt-4 border-t border-gray-100 border-dashed">
                                            <h3 className="text-[11px] font-black text-[#1F7A6E] uppercase tracking-widest">Urgency & Capacity</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Priority Level</label>
                                                    <div className="flex gap-2">
                                                        {['low', 'medium', 'high', 'urgent'].map(p => (
                                                            <button
                                                                key={p}
                                                                onClick={() => setFormData({ ...formData, priority: p })}
                                                                className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase border transition-all ${formData.priority === p
                                                                    ? 'bg-[#1F7A6E] text-white border-[#1F7A6E] shadow-lg shadow-[#1F7A6E]/20'
                                                                    : 'bg-white text-gray-400 border-gray-200 hover:border-[#1F7A6E] hover:text-[#1F7A6E]'
                                                                    }`}
                                                            >
                                                                {p}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Headcount</label>
                                                    <input
                                                        type="number"
                                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-4 focus:ring-[#1F7A6E]/10 focus:border-[#1F7A6E] transition-all text-sm font-bold"
                                                        value={formData.headcount}
                                                        onChange={(e) => setFormData({ ...formData, headcount: parseInt(e.target.value) })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Type</label>
                                                    <select
                                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-4 focus:ring-[#1F7A6E]/10 focus:border-[#1F7A6E] transition-all text-sm font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207L10%2012L15%207%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:20px_20px] bg-[right_1.25rem_center] bg-no-repeat"
                                                        value={formData.position_type}
                                                        onChange={(e) => setFormData({ ...formData, position_type: e.target.value as any })}
                                                    >
                                                        <option value="new">✦ New Position</option>
                                                        <option value="replacement">↺ Replacement</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <section className="space-y-4">
                                            <h3 className="text-[11px] font-black text-[#1F7A6E] uppercase tracking-widest">Financials & Context</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Monthly Salary Budget (ETB)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-300">ETB</span>
                                                        <input
                                                            type="number"
                                                            className="w-full pl-14 pr-5 py-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-4 focus:ring-[#1F7A6E]/10 focus:border-[#1F7A6E] transition-all font-black text-[#1A2B3D]"
                                                            value={formData.budget || ''}
                                                            onChange={(e) => setFormData({ ...formData, budget: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Internal Notes / Justification</label>
                                                    <textarea
                                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-4 focus:ring-[#1F7A6E]/10 focus:border-[#1F7A6E] transition-all text-sm font-medium h-40 leading-relaxed placeholder:text-gray-300"
                                                        placeholder="Provide context for HR regarding why this role is needed now..."
                                                        value={formData.description}
                                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    />
                                                </div>
                                                <div className="pt-4 border-t border-gray-100 border-dashed">
                                                    <label className="block text-[11px] font-black text-[#1F7A6E] uppercase tracking-widest mb-3">Job Description (JD) File</label>
                                                    <div className={`relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center ${jdFile ? 'border-[#1F7A6E] bg-emerald-50/30' : 'border-gray-200 hover:border-[#1F7A6E] bg-gray-50/50'}`}>
                                                        <input
                                                            type="file"
                                                            onChange={(e) => setJdFile(e.target.files ? e.target.files[0] : null)}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                            accept=".pdf,.doc,.docx"
                                                        />
                                                        <div className="space-y-2">
                                                            {jdFile ? (
                                                                <>
                                                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-emerald-600 mb-2 mx-auto">
                                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                                                    </div>
                                                                    <p className="text-sm font-black text-[#1A2B3D] truncate max-w-[200px]">{jdFile.name}</p>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Click to replace file</p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-300 mb-2 mx-auto">
                                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                                                    </div>
                                                                    <p className="text-sm font-black text-[#1F7A6E]">Upload JD Document</p>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">PDF or Word (Max 5MB)</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 border-t border-gray-100 flex gap-4 bg-gray-50/50">
                                {wizardStep === 2 && (
                                    <button
                                        onClick={() => setWizardStep(1)}
                                        className="flex-1 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border border-gray-200 hover:bg-white rounded-lg transition-all"
                                    >
                                        Back to Details
                                    </button>
                                )}
                                <button
                                    onClick={() => wizardStep === 1 ? setWizardStep(2) : handleSubmit()}
                                    disabled={submitting || (wizardStep === 1 && (!formData.title || !formData.department))}
                                    className="flex-[2] py-4 bg-[#1F7A6E] text-white rounded-lg text-[11px] font-black tracking-widest uppercase shadow-xl shadow-[#1F7A6E]/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            {wizardStep === 1 ? 'Continue to Financials' : 'Submit for Approval'}
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div >
    );
}
