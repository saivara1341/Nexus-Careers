
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Input } from '../../components/ui/Input.tsx';
import type { CompanyProfile, Opportunity } from '../../types.ts';
import { downloadCsv } from '../../utils/csv.ts';

interface CorporateJobBoardProps {
    user: CompanyProfile;
    onPostClick: () => void;
    onViewPipeline: (job: Opportunity) => void;
}

const fetchCompanyStats = async (supabase: any, companyName: string) => {
    // Get all opportunities by this company
    const { data: opps } = await supabase.from('opportunities').select('id, title, status, created_at, deadline').eq('company', companyName);
    const oppIds = opps?.map((o: any) => o.id) || [];
    
    if (oppIds.length === 0) {
        return {
            applicants: 0,
            assessment: 0,
            interviewing: 0,
            hired: 0,
            activeJobs: 0,
            avgApplicants: 0,
            conversionRate: 0,
            pendingReview: 0,
            staleJobs: 0,
            urgentJobs: 0
        };
    }

    // Get application stats
    const { data: apps } = await supabase.from('applications').select('opportunity_id, status, current_stage, created_at').in('opportunity_id', oppIds);
    const applicationCountByJob = (apps || []).reduce((acc: Record<string, number>, app: any) => {
        acc[app.opportunity_id] = (acc[app.opportunity_id] || 0) + 1;
        return acc;
    }, {});

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const twentyOneDays = 21 * 24 * 60 * 60 * 1000;
    const activeJobs = (opps || []).filter((o: any) => o.status === 'active');
    
    const stats = {
        applicants: apps?.length || 0,
        assessment: apps?.filter((a: any) => a.current_stage === 'Assessment' || a.status === 'shortlisted').length || 0,
        interviewing: apps?.filter((a: any) => a.current_stage === 'Interview').length || 0,
        hired: apps?.filter((a: any) => a.status === 'hired' || a.status === 'offered').length || 0,
        activeJobs: activeJobs.length,
        avgApplicants: oppIds.length ? Math.round(((apps?.length || 0) / oppIds.length) * 10) / 10 : 0,
        conversionRate: apps?.length ? Math.round((((apps || []).filter((a: any) => a.status === 'hired' || a.status === 'offered').length) / apps.length) * 100) : 0,
        pendingReview: apps?.filter((a: any) => !a.current_stage || ['Registration', 'Applied'].includes(a.current_stage) || a.status === 'applied').length || 0,
        staleJobs: activeJobs.filter((job: any) => !applicationCountByJob[job.id] && now - new Date(job.created_at).getTime() > twentyOneDays).length,
        urgentJobs: activeJobs.filter((job: any) => {
            const deadlineTime = new Date(job.deadline).getTime();
            return deadlineTime >= now && deadlineTime - now <= sevenDays;
        }).length
    };
    return stats;
};

const fetchCompanyJobs = async (supabase: any, companyName: string) => {
    const { data } = await supabase.from('opportunities')
        .select('*')
        .eq('company', companyName)
        .order('created_at', { ascending: false });
    return data as Opportunity[] || [];
};

const CorporateJobBoard: React.FC<CorporateJobBoardProps> = ({ user, onPostClick, onViewPipeline }) => {
    const supabase = useSupabase();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'under_review' | 'archived'>('all');

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['companyStats', user.company_name],
        queryFn: () => fetchCompanyStats(supabase, user.company_name)
    });

    const { data: jobs, isLoading: jobsLoading } = useQuery({
        queryKey: ['companyJobs', user.company_name],
        queryFn: () => fetchCompanyJobs(supabase, user.company_name)
    });

    const filteredJobs = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase();
        return (jobs || []).filter(job => {
            const matchesSearch = !normalized || [job.title, job.college, job.description].some(value => (value || '').toLowerCase().includes(normalized));
            const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [jobs, searchTerm, statusFilter]);

    const urgentJobs = useMemo(() => {
        const now = new Date();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        return (jobs || []).filter(job => {
            const deadline = new Date(job.deadline);
            return job.status === 'active' && deadline.getTime() >= now.getTime() && deadline.getTime() - now.getTime() <= sevenDays;
        }).length;
    }, [jobs]);

    const handleExportJobs = () => {
        if (!filteredJobs.length) return;
        downloadCsv(filteredJobs.map(job => ({
            Title: job.title,
            College: job.college,
            Status: job.status,
            Package_LPA: job.package_lpa || '',
            Min_CGPA: job.min_cgpa,
            Deadline: new Date(job.deadline).toLocaleDateString(),
            Pipeline_Stages: (job.ai_analysis?.pipeline || job.pipeline_stages || []).join(' > ') || 'Applied > Verification > Assessment > Interview > Offer'
        })), `${user.company_name.replace(/[^a-z0-9]/gi, '_')}_job_listings.csv`);
    };

    return (
        <div>
            <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 mb-6 md:mb-8">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-muted font-bold mb-2">Corporate Talent Console</p>
                    <h1 className="font-display text-2xl md:text-3xl text-primary">Recruitment Dashboard</h1>
                    <p className="text-sm text-text-muted mt-1">Manage jobs, pipelines, SLA deadlines, and campus hiring outcomes.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="ghost" onClick={handleExportJobs} disabled={!filteredJobs.length} className="text-sm border-white/10">Export Listings</Button>
                    <Button variant="secondary" onClick={onPostClick} className="text-sm">+ Post New Opportunity</Button>
                </div>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-8">
                <StatCard title="Active Jobs" value={stats?.activeJobs || 0} loading={statsLoading} color="text-primary" />
                <StatCard title="Total Applicants" value={stats?.applicants || 0} loading={statsLoading} />
                <StatCard title="In Assessment" value={stats?.assessment || 0} loading={statsLoading} />
                <StatCard title="Interviewing" value={stats?.interviewing || 0} loading={statsLoading} />
                <StatCard title="Selected" value={stats?.hired || 0} loading={statsLoading} color="text-green-400" />
                <StatCard title="SLA Due Soon" value={urgentJobs} loading={statsLoading || jobsLoading} color="text-yellow-400" />
            </div>

            <Card glow="none" className="mb-6 border-white/10 bg-black/20">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <HealthSignal label="Selection Rate" value={`${stats?.conversionRate || 0}%`} tone="green" loading={statsLoading} />
                    <HealthSignal label="Pending Review" value={stats?.pendingReview || 0} tone="yellow" loading={statsLoading} />
                    <HealthSignal label="No Applicant Roles" value={stats?.staleJobs || 0} tone="red" loading={statsLoading} />
                    <HealthSignal label="Avg Applicants" value={stats?.avgApplicants || 0} tone="cyan" loading={statsLoading} />
                </div>
            </Card>

            <Card glow="none" className="mb-6 border-white/10 bg-card-bg/40">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
                    <Input
                        label="Search Listings"
                        placeholder="Search role, campus, or description"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div>
                        <label className="block text-primary font-display text-sm font-bold uppercase mb-2 tracking-tight">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full lg:w-48 bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="under_review">Under Review</option>
                            <option value="expired">Expired</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div className="text-xs text-text-muted bg-black/20 border border-white/10 rounded-md p-3 min-w-40">
                        Avg applicants/job
                        <span className="block text-xl text-secondary font-bold">{stats?.avgApplicants || 0}</span>
                    </div>
                </div>
            </Card>

            <div className="flex justify-between items-center mb-4">
                <h2 className="font-display text-xl text-secondary">Listings Workspace</h2>
                <span className="text-xs text-text-muted">{filteredJobs.length} visible</span>
            </div>
            {jobsLoading ? <div className="flex justify-center"><Spinner /></div> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredJobs.length === 0 && <p className="text-text-muted text-sm">No job postings match the current filters.</p>}
                    {filteredJobs.map(job => {
                        const daysLeft = Math.ceil((new Date(job.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                        const pipeline = job.ai_analysis?.pipeline || job.pipeline_stages || ['Applied', 'Verification', 'Assessment', 'Interview', 'Offer'];
                        return (
                        <Card key={job.id} glow="none" className="border-l-4 border-l-primary flex flex-col justify-between p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-primary">{job.title}</h3>
                                    <p className="text-xs text-text-muted">Target: {job.college}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded">{job.package_lpa ? `${job.package_lpa} LPA` : 'Package TBD'}</span>
                                        <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded">CGPA {job.min_cgpa}+</span>
                                        <span className={`text-[10px] border px-2 py-1 rounded ${daysLeft <= 7 && daysLeft >= 0 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' : 'text-text-muted bg-white/5 border-white/10'}`}>
                                            {daysLeft >= 0 ? `${daysLeft} days left` : 'Closed'}
                                        </span>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${job.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{job.status}</span>
                            </div>
                            <p className="text-xs text-text-muted line-clamp-2 mb-4">{job.description}</p>
                            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center mt-auto">
                                <span className="text-xs text-text-muted">Pipeline: {pipeline.length} stages</span>
                                <Button variant="ghost" className="text-xs py-1 h-8" onClick={() => onViewPipeline(job)}>Manage Candidates</Button>
                            </div>
                        </Card>
                    )})}
                </div>
            )}
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: number; loading: boolean; color?: string }> = ({ title, value, loading, color = 'text-white' }) => (
    <Card className="text-center py-4 px-2">
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">{title}</p>
        {loading ? <Spinner className="w-5 h-5 mx-auto" /> : <p className={`font-mono text-2xl md:text-3xl font-bold ${color}`}>{value}</p>}
    </Card>
);

const HealthSignal: React.FC<{ label: string; value: string | number; tone: 'green' | 'yellow' | 'red' | 'cyan'; loading: boolean }> = ({ label, value, tone, loading }) => {
    const toneClass = {
        green: 'text-green-400 border-green-500/20 bg-green-500/5',
        yellow: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5',
        red: 'text-red-400 border-red-500/20 bg-red-500/5',
        cyan: 'text-primary border-primary/20 bg-primary/5'
    }[tone];

    return (
        <div className={`rounded-lg border p-4 ${toneClass}`}>
            <p className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-2">{label}</p>
            {loading ? <Spinner className="w-4 h-4" /> : <p className="font-display text-2xl font-bold">{value}</p>}
        </div>
    );
};

export default CorporateJobBoard;
