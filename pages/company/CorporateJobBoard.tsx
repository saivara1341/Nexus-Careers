
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import type { CompanyProfile, Opportunity } from '../../types.ts';

interface CorporateJobBoardProps {
    user: CompanyProfile;
    onPostClick: () => void;
    onViewPipeline: (job: Opportunity) => void;
}

const fetchCompanyStats = async (supabase: any, companyName: string) => {
    // Get all opportunities by this company
    const { data: opps } = await supabase.from('opportunities').select('id').eq('company', companyName);
    const oppIds = opps?.map((o: any) => o.id) || [];
    
    if (oppIds.length === 0) return { applicants: 0, assessment: 0, interviewing: 0, hired: 0 };

    // Get application stats
    const { data: apps } = await supabase.from('applications').select('status, current_stage').in('opportunity_id', oppIds);
    
    const stats = {
        applicants: apps?.length || 0,
        assessment: apps?.filter((a: any) => a.current_stage === 'Assessment' || a.status === 'shortlisted').length || 0,
        interviewing: apps?.filter((a: any) => a.current_stage === 'Interview').length || 0,
        hired: apps?.filter((a: any) => a.status === 'hired' || a.status === 'offered').length || 0
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

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['companyStats', user.company_name],
        queryFn: () => fetchCompanyStats(supabase, user.company_name)
    });

    const { data: jobs, isLoading: jobsLoading } = useQuery({
        queryKey: ['companyJobs', user.company_name],
        queryFn: () => fetchCompanyJobs(supabase, user.company_name)
    });

    return (
        <div>
            <div className="flex justify-between items-center mb-6 md:mb-8">
                <h1 className="font-display text-2xl md:text-3xl text-primary">Recruitment Dashboard</h1>
                <Button variant="secondary" onClick={onPostClick} className="text-sm">+ Post New Opportunity</Button>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <StatCard title="Total Applicants" value={stats?.applicants || 0} loading={statsLoading} />
                <StatCard title="In Assessment" value={stats?.assessment || 0} loading={statsLoading} />
                <StatCard title="Interviewing" value={stats?.interviewing || 0} loading={statsLoading} />
                <StatCard title="Selected" value={stats?.hired || 0} loading={statsLoading} color="text-green-400" />
            </div>

            <h2 className="font-display text-xl text-secondary mb-4">Active Listings</h2>
            {jobsLoading ? <div className="flex justify-center"><Spinner /></div> : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {jobs?.length === 0 && <p className="text-text-muted text-sm">No active job postings.</p>}
                    {jobs?.map(job => (
                        <Card key={job.id} glow="none" className="border-l-4 border-l-primary flex flex-col justify-between p-4">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-primary">{job.title}</h3>
                                    <p className="text-xs text-text-muted">Target: {job.college}</p>
                                    <p className="text-[10px] text-text-muted mt-1">Deadline: {new Date(job.deadline).toLocaleDateString()}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${job.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{job.status}</span>
                            </div>
                            <div className="pt-3 border-t border-white/10 flex justify-between items-center mt-auto">
                                <span className="text-xs text-text-muted">Stages: {job.ai_analysis?.pipeline?.length || 5}</span>
                                <Button variant="ghost" className="text-xs py-1 h-8" onClick={() => onViewPipeline(job)}>Manage Candidates</Button>
                            </div>
                        </Card>
                    ))}
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

export default CorporateJobBoard;
