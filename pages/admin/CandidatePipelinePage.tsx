
// pages/admin/CandidatePipelinePage.tsx
import React, { useState, useMemo } from 'react';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { Opportunity, Application } from '../../types.ts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import * as XLSX from 'xlsx';
import { runAI } from '../../services/aiClient.ts';

const runDeepAnalysis = async (supabase: any, jobTitle: string, jobDescription: string, candidates: Application[]) => {
    // Truncate job description
    const truncatedDescription = jobDescription.length > 500 ? jobDescription.substring(0, 500) + '...' : jobDescription;

    // STRICT LIMIT: Top 5 candidates only to ensure Edge Function success and speed (Free Model optimization)
    const limitedCandidates = candidates.slice(0, 5);

    const candidateData = limitedCandidates.map(app => ({
        id: app.student_id,
        cgpa: app.student?.ug_cgpa,
        backlogs: app.student?.backlogs,
        dept: app.student?.department,
        section: app.student?.section,
    }));

    return await runAI({
        task: 'candidate-pool-analysis',
        payload: { jobTitle, jobDescription: truncatedDescription, candidates: candidateData },
        supabase,
    });
};

export const CandidatePipelinePage: React.FC<{ opportunity: Opportunity; onBack: () => void }> = ({ opportunity, onBack }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [isSparkRunning, setIsSparkRunning] = useState(false);
    const [filterSection, setFilterSection] = useState('All');

    const { data: applications = [] } = useQuery<Application[]>({
        queryKey: ['candidates', opportunity.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('applications').select('*, student:students(*)').eq('opportunity_id', opportunity.id);
            if (error) throw error;
            return data || [];
        }
    });

    const analysisMutation = useMutation({
        mutationFn: () => runDeepAnalysis(supabase, opportunity.title, opportunity.description, applications),
        onSuccess: (data) => { setAnalysisResult(data); setIsSparkRunning(false); toast.success("AI Analysis complete."); },
        onError: (error) => { handleAiInvocationError(error); setIsSparkRunning(false); }
    });

    const handleExport = () => {
        if (!applications.length) {
            toast.error("No candidates to export.");
            return;
        }

        const exportData = applications.map(app => ({
            'Name': app.student?.name,
            'Roll No': app.student?.roll_number,
            'Email': app.student?.email,
            'Personal Email': app.student?.personal_email,
            'Mobile': app.student?.mobile_number,
            'Department': app.student?.department,
            'Section': app.student?.section,
            'Gender': app.student?.gender,
            'CGPA': app.student?.ug_cgpa,
            'Backlogs': app.student?.backlogs,
            'Stage': app.current_stage || 'Applied',
            'Status': app.status,
            'Applied Date': new Date(app.created_at).toLocaleDateString()
        }));

        const safeTitle = opportunity.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pipeline");
        XLSX.writeFile(wb, `${safeTitle}_Pipeline_Candidates.xlsx`);
        toast.success("Export successful!");
    };

    const pipelineStages = opportunity.ai_analysis?.pipeline || ['Applied', 'Verification', 'Assessment', 'Interview', 'Offer'];

    const filteredApplications = useMemo(() => {
        return applications.filter(app => (filterSection === 'All' || app.student?.section === filterSection) && app.status !== 'rejected');
    }, [applications, filterSection]);

    const sections = useMemo(() => {
        const uniqueSections = new Set(applications.map(a => a.student?.section).filter((s): s is string => !!s));
        return ['All', ...Array.from(uniqueSections).sort()];
    }, [applications]);

    const stageCounts = useMemo(() => {
        const counts: { [key: string]: number } = {};
        for (const stage of pipelineStages) {
            counts[stage] = 0;
        }
        for (const app of filteredApplications) {
            const stage = app.current_stage || pipelineStages[0];
            if (counts[stage] !== undefined) {
                counts[stage]++;
            }
        }
        return counts;
    }, [filteredApplications, pipelineStages]);

    return (
        <div className="flex flex-col h-full bg-background font-body">
            <header className="mb-8 p-6 border-b border-primary/20 bg-card-bg/50">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <button onClick={onBack} className="text-text-muted hover:text-primary mb-2 text-xs flex items-center gap-1 transition-colors uppercase font-bold tracking-widest">
                            <span className="material-symbols-outlined text-sm">arrow_back</span> Back to Manager
                        </button>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            {opportunity.title}
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            {opportunity.company} • Real-time institutional candidate tracking and AI-assisted screening.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-black/20 p-2 rounded-lg border border-white/5">
                        <select
                            className="bg-card-bg border border-primary/30 text-white rounded p-2 text-xs font-bold focus:outline-none focus:border-primary"
                            value={filterSection}
                            onChange={e => setFilterSection(e.target.value)}
                        >
                            {sections.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sections' : `Section ${s}`}</option>)}
                        </select>

                        <Button variant="ghost" onClick={handleExport} className="text-[10px] py-2 px-3 flex items-center gap-2 border border-primary/20 hover:border-primary/50">
                            <span className="material-symbols-outlined text-sm">download</span> Export
                        </Button>

                        <Button variant="secondary" onClick={() => { setIsSparkRunning(true); analysisMutation.mutate(); }} disabled={isSparkRunning} className="text-[10px] py-2">
                            {isSparkRunning ? <Spinner className="w-3 h-3" /> : '✨ AI Strategic Probe'}
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-4 bg-card-bg/30 border-b border-primary/20 flex flex-wrap gap-x-12 gap-y-2 justify-center items-center">
                {pipelineStages.map((stage, index) => (
                    <React.Fragment key={stage}>
                        <div className="text-center group">
                            <span className="font-display text-[10px] uppercase tracking-[0.2em] text-text-muted group-hover:text-primary transition-colors">{stage}</span>
                            <p className="font-mono text-2xl font-bold text-white group-hover:text-primary transition-colors">{stageCounts[stage]}</p>
                        </div>
                        {index < pipelineStages.length - 1 && <div className="h-4 w-[1px] bg-primary/20"></div>}
                    </React.Fragment>
                ))}
            </div>

            {analysisResult && (
                <div className="p-6 bg-secondary/5 border-b border-secondary/20 animate-fade-in-up">
                    <h3 className="text-secondary font-display text-xs font-black uppercase tracking-widest mb-3">AI Candidate Pool Report</h3>
                    <div className="bg-black/30 p-4 rounded-lg border border-secondary/20">
                        <MarkdownRenderer content={analysisResult.summary_markdown} />
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-x-auto p-6 flex gap-6 custom-scrollbar">
                {pipelineStages.map((stage, idx) => (
                    <div key={stage} className={`w-80 flex flex-col h-full min-h-[400px] rounded-2xl border-t-2 bg-card-bg/10 backdrop-blur-sm ${stage === 'Verification' ? 'border-yellow-500 bg-yellow-500/[0.02]' : 'border-primary/40'}`}>
                        <div className="p-4 border-b border-white/5 font-display text-sm font-bold flex justify-between items-center bg-white/5 rounded-t-2xl">
                            <span className="uppercase tracking-widest">{stage}</span>
                            <span className="text-[10px] bg-primary/10 px-2 py-0.5 rounded-full text-primary font-mono border border-primary/20">
                                {stageCounts[stage]}
                            </span>
                        </div>
                        <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
                            {filteredApplications.filter(a => (a.current_stage || pipelineStages[0]) === stage).map(app => (
                                <div key={app.id} className="bg-card-bg border border-white/5 p-4 rounded-xl shadow-lg hover:border-primary/40 transition-all group relative">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-sm text-white truncate w-40 group-hover:text-primary transition-colors">{app.student?.name}</h4>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${app.student?.backlogs > 0 ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
                                            {app.student?.backlogs || 0} BK
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-text-muted font-mono mb-3 uppercase">{app.student?.roll_number}</p>

                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                                            <span className="text-[8px] text-text-muted block uppercase">CGPA</span>
                                            <span className="text-xs font-bold text-secondary">{app.student?.ug_cgpa?.toFixed(2) || 'N/A'}</span>
                                        </div>
                                        <div className="bg-black/30 p-2 rounded-lg border border-white/5 text-center">
                                            <span className="text-[8px] text-text-muted block uppercase">Section</span>
                                            <span className="text-xs font-bold text-white">{app.student?.section || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Stages Completion Line */}
                                    <div className="flex gap-1 mb-2">
                                        {pipelineStages.map((s, i) => (
                                            <div
                                                key={s}
                                                className={`h-1 flex-1 rounded-full ${i < idx ? 'bg-green-500' : i === idx ? 'bg-primary animate-pulse' : 'bg-gray-800'}`}
                                                title={s}
                                            />
                                        ))}
                                    </div>

                                    {/* AI Verification Context */}
                                    {stage === 'Verification' && (
                                        <div className="mt-3 p-2 bg-yellow-500/5 border border-yellow-500/20 rounded flex items-center gap-2">
                                            {app.status === 'verifying' ? (
                                                <>
                                                    <Spinner className="w-3 h-3" />
                                                    <span className="text-[9px] text-yellow-400 font-bold uppercase">AI Verifying Proof</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></div>
                                                    <span className="text-[9px] text-yellow-400 font-bold uppercase">AI Validation Queue</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {analysisResult?.top_candidate_ids?.includes(app.student_id) && (
                                        <div className="mt-3 py-1 bg-green-500/10 border border-green-500/30 rounded text-center">
                                            <span className="text-[8px] text-green-400 font-black uppercase tracking-widest">★ AI RECOMMENDED MATCH</span>
                                        </div>
                                    )}

                                    {/* Action Buttons Removed per user request to prevent manual tampering */}
                                    {/* To allow actions, restore buttons here if needed later */}
                                </div>
                            ))}
                            {filteredApplications.filter(a => (a.current_stage || pipelineStages[0]) === stage).length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
                                    <span className="text-4xl mb-2">🔭</span>
                                    <p className="text-[10px] uppercase font-bold tracking-widest">No candidates</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
