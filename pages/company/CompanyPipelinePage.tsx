
import React, { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { Opportunity, Application } from '../../types.ts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { runAI } from '../../services/aiClient.ts';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';

const updateCandidateStatus = async (supabase: any, applicationId: string, stage: string, status: string) => {
    const { error } = await supabase.from('applications').update({ 
        current_stage: stage,
        status: status 
    }).eq('id', applicationId);
    if (error) throw error;
};

const runDeepAnalysis = async (supabase: any, jobTitle: string, jobDescription: string, candidates: Application[]) => {
    // Truncate job description
    const truncatedDescription = jobDescription.length > 500 ? jobDescription.substring(0, 500) + '...' : jobDescription;

    // Limit candidates for AI analysis context
    const limitedCandidates = candidates.slice(0, 10);
    
    const candidateData = limitedCandidates.map(app => ({
        id: app.student_id,
        cgpa: app.student?.ug_cgpa,
        backlogs: app.student?.backlogs,
        dept: app.student?.department,
    }));
    
    return await runAI({
        task: 'candidate-pool-analysis',
        payload: { jobTitle, jobDescription: truncatedDescription, candidates: candidateData },
        supabase,
    });
};

const CompanyPipelinePage: React.FC<{ opportunity: Opportunity; onBack: () => void }> = ({ opportunity, onBack }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list'); // Default to 'list' for Superset feel
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [isSparkRunning, setIsSparkRunning] = useState(false);

    // Filters
    const [filterDept, setFilterDept] = useState('All');
    const [minCgpa, setMinCgpa] = useState(0);
    const [filterGender, setFilterGender] = useState('All');
    const [maxBacklogs, setMaxBacklogs] = useState<number | 'Any'>('Any');

    const { data: applications = [], isLoading } = useQuery<Application[]>({
        queryKey: ['candidates', opportunity.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('applications')
                .select('*, student:students(*)')
                .eq('opportunity_id', opportunity.id);
            if (error) throw error;
            return data || [];
        }
    });

    const statusMutation = useMutation({
        mutationFn: ({ appId, stage, status }: { appId: string, stage: string, status: string }) => updateCandidateStatus(supabase, appId, stage, status),
        onSuccess: () => { 
            queryClient.invalidateQueries({ queryKey: ['candidates', opportunity.id] });
            toast.success("Status updated");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const analysisMutation = useMutation({
        mutationFn: () => runDeepAnalysis(supabase, opportunity.title, opportunity.description, applications),
        onSuccess: (data) => { setAnalysisResult(data); setIsSparkRunning(false); toast.success("AI Analysis complete."); },
        onError: (error) => { handleAiInvocationError(error); setIsSparkRunning(false); }
    });

    // Helper functions
    const pipelineStages = opportunity.ai_analysis?.pipeline || ['Applied', 'Verification', 'Assessment', 'Interview', 'Offer'];

    const filteredApplications = useMemo(() => {
        return applications.filter(app => {
            if (app.status === 'rejected') return false; // Hide rejected by default in main view
            if (filterDept !== 'All' && app.student?.department !== filterDept) return false;
            if (app.student?.ug_cgpa !== undefined && app.student.ug_cgpa < minCgpa) return false;
            if (filterGender !== 'All' && app.student?.gender !== filterGender) return false;
            if (maxBacklogs !== 'Any' && (app.student?.backlogs || 0) > maxBacklogs) return false;
            return true;
        });
    }, [applications, filterDept, minCgpa, filterGender, maxBacklogs]);

    const departments = useMemo(() => ['All', ...new Set(applications.map(a => a.student?.department).filter(Boolean))], [applications]);

    // Bulk Actions
    const handleBulkMove = (stage: string) => {
        if (selectedIds.size === 0) return;
        let status = 'shortlisted';
        if (stage === 'Offer') status = 'offered';
        else if (stage === 'Verified') status = 'verified';
        
        const promises = Array.from(selectedIds).map((id) => updateCandidateStatus(supabase, id as string, stage, status));
        Promise.all(promises).then(() => {
            toast.success(`Moved ${selectedIds.size} candidates to ${stage}`);
            queryClient.invalidateQueries({ queryKey: ['candidates', opportunity.id] });
            setSelectedIds(new Set());
        }).catch(e => toast.error("Bulk update failed"));
    };

    const handleBulkReject = () => {
        if (!confirm(`Reject ${selectedIds.size} candidates?`)) return;
        const promises = Array.from(selectedIds).map((id) => updateCandidateStatus(supabase, id as string, 'Rejected', 'rejected'));
        Promise.all(promises).then(() => {
            toast.success(`Rejected ${selectedIds.size} candidates`);
            queryClient.invalidateQueries({ queryKey: ['candidates', opportunity.id] });
            setSelectedIds(new Set());
        }).catch(e => toast.error("Bulk rejection failed"));
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredApplications.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredApplications.map(a => a.id)));
    };

    const getStageColor = (idx: number) => {
        const colors = ['border-blue-500', 'border-indigo-500', 'border-purple-500', 'border-pink-500', 'border-green-500'];
        return colors[idx % colors.length];
    };

    return (
        <div className="flex flex-col h-full bg-background/50">
            {/* Header */}
            <div className="p-4 bg-card-bg border-b border-primary/20 backdrop-blur-md sticky top-0 z-30 shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <button onClick={onBack} className="text-text-muted hover:text-primary mb-1 text-sm flex items-center gap-1 transition-colors">
                            ← Back to Dashboard
                        </button>
                        <h1 className="font-display text-2xl md:text-3xl text-primary">{opportunity.title}</h1>
                        <p className="text-text-muted text-sm">{opportunity.company} • {applications.length} Candidates</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => { setIsSparkRunning(true); analysisMutation.mutate(); }} disabled={isSparkRunning} className="text-sm">
                            {isSparkRunning ? <Spinner className="w-4 h-4"/> : '✨ AI Insight'}
                        </Button>
                        <div className="bg-black/40 p-1 rounded-lg border border-white/10 flex">
                            <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded text-sm transition-colors ${viewMode === 'list' ? 'bg-primary text-black font-bold' : 'text-text-muted hover:text-white'}`}>List View</button>
                            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1 rounded text-sm transition-colors ${viewMode === 'kanban' ? 'bg-primary text-black font-bold' : 'text-text-muted hover:text-white'}`}>Kanban</button>
                        </div>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap items-center gap-4 bg-black/20 p-3 rounded-lg border border-white/5">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Filters:</span>
                    
                    <select className="bg-input-bg border border-white/10 rounded text-sm px-2 py-1 outline-none focus:border-primary" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                        <option value="All">All Depts</option>
                        {departments.map((d: any) => <option key={d} value={d}>{d}</option>)}
                    </select>

                    <div className="flex items-center gap-2 text-sm text-text-muted">
                        <span>CGPA &gt;</span>
                        <input type="number" step="0.5" className="w-16 bg-input-bg border border-white/10 rounded px-2 py-1 outline-none focus:border-primary text-white" value={minCgpa} onChange={e => setMinCgpa(parseFloat(e.target.value) || 0)} />
                    </div>

                    <select className="bg-input-bg border border-white/10 rounded text-sm px-2 py-1 outline-none focus:border-primary" value={maxBacklogs} onChange={e => setMaxBacklogs(e.target.value === 'Any' ? 'Any' : parseInt(e.target.value))}>
                        <option value="Any">Backlogs: Any</option>
                        <option value="0">0 Backlogs</option>
                        <option value="1">Max 1</option>
                        <option value="2">Max 2</option>
                    </select>

                    <select className="bg-input-bg border border-white/10 rounded text-sm px-2 py-1 outline-none focus:border-primary" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                        <option value="All">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>

                    <div className="ml-auto text-sm text-text-muted">
                        Showing {filteredApplications.length} candidates
                    </div>
                </div>

                {/* Bulk Actions Bar (Visible in List Mode when items selected) */}
                {viewMode === 'list' && selectedIds.size > 0 && (
                    <div className="mt-3 flex items-center gap-3 animate-fade-in-up bg-primary/10 p-2 rounded border border-primary/30">
                        <span className="text-sm font-bold text-primary ml-2">{selectedIds.size} Selected</span>
                        <div className="h-4 w-[1px] bg-primary/30"></div>
                        <span className="text-xs text-text-muted uppercase">Move to:</span>
                        {pipelineStages.map(stage => (
                            <button key={stage} onClick={() => handleBulkMove(stage)} className="px-2 py-1 bg-card-bg border border-white/10 rounded text-xs hover:border-primary transition-colors">{stage}</button>
                        ))}
                        <button onClick={handleBulkReject} className="ml-auto px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/50 rounded text-xs hover:bg-red-500 hover:text-white transition-colors">Reject Selected</button>
                    </div>
                )}
            </div>

            {/* AI Insights Panel */}
            {analysisResult && (
                <div className="p-4 mx-4 mt-4 bg-secondary/5 border border-secondary/20 rounded-lg">
                    <h3 className="text-secondary font-display text-lg mb-2">AI Talent Insights</h3>
                    <MarkdownRenderer content={analysisResult.summary_markdown} />
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-4">
                {isLoading ? <div className="flex justify-center p-12"><Spinner /></div> : viewMode === 'list' ? (
                    // LIST VIEW (Superset Style)
                    <div className="h-full overflow-auto bg-card-bg border border-white/10 rounded-lg shadow-inner custom-scrollbar">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-white/5 text-text-muted uppercase text-xs font-bold sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="p-3 w-10 text-center"><input type="checkbox" checked={selectedIds.size === filteredApplications.length && filteredApplications.length > 0} onChange={toggleSelectAll} /></th>
                                    <th className="p-3">Candidate Name</th>
                                    <th className="p-3">Department</th>
                                    <th className="p-3 text-center">CGPA</th>
                                    <th className="p-3 text-center">Backlogs</th>
                                    <th className="p-3 text-center">Current Stage</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredApplications.map(app => (
                                    <tr key={app.id} className={`hover:bg-white/5 transition-colors ${selectedIds.has(app.id) ? 'bg-primary/5' : ''}`}>
                                        <td className="p-3 text-center"><input type="checkbox" checked={selectedIds.has(app.id)} onChange={() => toggleSelect(app.id)} /></td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                {app.student?.profile_photo_url ? (
                                                    <img src={app.student.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">{app.student?.name?.charAt(0)}</div>
                                                )}
                                                <div>
                                                    <p className="font-bold text-white">{app.student?.name}</p>
                                                    <p className="text-xs text-text-muted">{app.student?.roll_number}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3">{app.student?.department}</td>
                                        <td className="p-3 text-center font-mono text-secondary font-bold">{app.student?.ug_cgpa?.toFixed(2)}</td>
                                        <td className={`p-3 text-center font-bold ${app.student?.backlogs > 0 ? 'text-red-400' : 'text-green-400'}`}>{app.student?.backlogs}</td>
                                        <td className="p-3 text-center"><span className="bg-white/10 px-2 py-1 rounded text-xs">{app.current_stage || 'Applied'}</span></td>
                                        <td className="p-3 text-center">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${app.status === 'verified' || app.status === 'offered' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-white/5 text-text-muted border-white/10'}`}>
                                                {app.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-xs text-text-muted">
                                            {app.student?.email}<br/>{app.student?.mobile_number}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredApplications.length === 0 && <div className="p-8 text-center text-text-muted">No candidates match current filters.</div>}
                    </div>
                ) : (
                    // KANBAN VIEW (Original)
                    <div className="flex gap-6 h-full overflow-x-auto min-w-max pb-4">
                        {pipelineStages.map((stage, idx) => {
                            const stageApps = filteredApplications.filter(a => (a.current_stage || pipelineStages[0]) === stage);
                            return (
                                <div key={stage} className={`flex flex-col w-80 max-h-full bg-card-bg/40 rounded-xl border-t-4 ${getStageColor(idx)} backdrop-blur-sm shadow-xl`}>
                                    <div className="p-4 border-b border-white/5 font-display text-lg font-bold flex justify-between items-center bg-white/5 rounded-t-lg">
                                        {stage}
                                        <span className="text-xs bg-primary/20 text-primary font-bold px-2 py-1 rounded-full">{stageApps.length}</span>
                                    </div>
                                    <div className="p-3 overflow-y-auto flex-1 custom-scrollbar space-y-3">
                                        {stageApps.map(app => (
                                            <div key={app.id} className="bg-card-bg border border-white/10 p-3 rounded-lg shadow-sm hover:border-primary/40 transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {app.student?.profile_photo_url && <img src={app.student.profile_photo_url} className="w-6 h-6 rounded-full object-cover" />}
                                                        <div>
                                                            <p className="font-bold text-sm text-white truncate w-32">{app.student?.name}</p>
                                                            <p className="text-[10px] text-text-muted">{app.student?.department}</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-mono text-xs font-bold text-secondary">{app.student?.ug_cgpa?.toFixed(2)}</span>
                                                </div>
                                                
                                                <div className="flex gap-2 mt-3 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    {idx < pipelineStages.length - 1 && (
                                                        <Button 
                                                            variant="primary" 
                                                            className="text-[10px] px-2 py-1 h-6 flex-1"
                                                            onClick={() => statusMutation.mutate({ appId: app.id, stage: pipelineStages[idx + 1], status: 'shortlisted' })}
                                                        >
                                                            Advance
                                                        </Button>
                                                    )}
                                                    <Button 
                                                        variant="ghost" 
                                                        className="text-[10px] px-2 py-1 h-6 flex-1 !text-red-400 !border-red-400 hover:!bg-red-500 hover:!text-white"
                                                        onClick={() => statusMutation.mutate({ appId: app.id, stage: 'Rejected', status: 'rejected' })}
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompanyPipelinePage;
