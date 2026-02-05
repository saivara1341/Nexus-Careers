
import React, { useState, useEffect } from 'react';
import type { AdminProfile, Opportunity } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import OpportunityReports from './OpportunityReports.tsx';
import { runAI } from '../../services/aiClient.ts';
import { logAdminAction } from '../../utils/adminLogger.ts';

const PAGE_SIZE = 10;

const fetchOpportunities = async (supabase: any, college: string, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
        .from('opportunities')
        .select('*', { count: 'exact' })
        .eq('college', college)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) throw error;

    const opportunitiesWithCounts = await Promise.all((data || []).map(async (opp: any) => {
        const { count } = await supabase.from('applications').select('*', { count: 'exact', head: true }).eq('opportunity_id', opp.id);
        return { ...opp, application_count: count || 0 };
    }));

    return { data: opportunitiesWithCounts as any[], count: count || 0 };
};

const sanitizeDate = (date: string | undefined | null) => {
    if (!date || date.trim() === '') return null;
    try {
        return new Date(date).toISOString();
    } catch (e) {
        return null;
    }
};

const upsertOpportunity = async (supabase: any, opportunity: Partial<Opportunity>) => {
    const { pipeline_stages, application_count, ...dbPayload } = opportunity as any;

    // Ensure we have a valid pipeline
    const finalPipeline = pipeline_stages && pipeline_stages.length > 0
        ? pipeline_stages
        : ['Registration', 'Assessment', 'Interview', 'Offer'];

    const sanitizedPayload = {
        ...dbPayload,
        deadline: sanitizeDate(dbPayload.deadline),
        ai_analysis: {
            ...(dbPayload.ai_analysis || { key_skills: [], resume_tips: '', interview_questions: [] }),
            pipeline: finalPipeline
        }
    };

    const { data, error } = await supabase.from('opportunities').upsert(sanitizedPayload).select();
    if (error) throw error;
    return data;
};

const OpportunityManagement: React.FC<{ user: AdminProfile, onNavigateToPipeline?: (opp: Opportunity) => void }> = ({ user, onNavigateToPipeline }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'manage' | 'reports'>('manage');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentOpp, setCurrentOpp] = useState<Opportunity | null>(null);
    const [isAIFetchModalOpen, setIsAIFetchModalOpen] = useState(false);
    const [isAISearchModalOpen, setIsAISearchModalOpen] = useState(false);
    const [initialLinkForScraper, setInitialLinkForScraper] = useState('');

    const { data: opportunitiesData, isLoading: isLoadingOpps } = useQuery({
        queryKey: ['opportunities', user.college, page],
        queryFn: () => fetchOpportunities(supabase, user.college, page),
        enabled: activeTab === 'manage',
    });

    const opportunities = opportunitiesData?.data || [];
    const count = opportunitiesData?.count || 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const saveMutation = useMutation({
        mutationFn: (data: Partial<Opportunity>) => upsertOpportunity(supabase, data),
        onSuccess: (data: any, variables: any) => {
            const isUpdate = !!variables.id;
            toast.success(isUpdate ? "Opportunity updated!" : "Opportunity launched!");

            // Forensic Logging
            logAdminAction(supabase, {
                admin_id: user.id,
                admin_name: user.name,
                action: isUpdate ? 'UPDATE' : 'CREATE',
                entity_type: 'opportunity',
                entity_id: data?.[0]?.id || variables.id,
                details: { title: variables.title, company: variables.company }
            });

            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
            setIsModalOpen(false);
        },
        onError: (error: any) => toast.error(error.message)
    });

    const handleOpenManualCreate = () => {
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 7);
        setCurrentOpp({
            title: '', company: '', description: '', min_cgpa: 6.0,
            allowed_departments: ['All'], college: user.college, posted_by: user.id,
            apply_link: '', deadline: defaultDeadline.toISOString(), status: 'active',
            pipeline_stages: ['Registration', 'Assessment', 'Interview', 'Offer']
        } as any);
        setIsAIFetchModalOpen(false);
        setIsModalOpen(true);
    };

    const handleOpenAIFilledModal = (scrapedData: any) => {
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 30);
        let deadlineStr = scrapedData.deadline || defaultDeadline.toISOString();

        setCurrentOpp({
            title: scrapedData.title || '', company: scrapedData.company || '',
            description: scrapedData.description || '', min_cgpa: scrapedData.min_cgpa || 6.0,
            allowed_departments: ['All'], college: user.college, posted_by: user.id,
            apply_link: scrapedData.apply_link || '', deadline: deadlineStr, status: 'active',
            pipeline_stages: scrapedData.pipeline || ['Registration', 'Assessment', 'Interview', 'Offer']
        } as any);
        setIsAIFetchModalOpen(false);
        setIsModalOpen(true);
    };

    return (
        <div>
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Opportunity Manager
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            Institutional job postings, AI-assisted scouting, and safety reports.
                        </p>
                    </div>
                    <div className="flex gap-2 bg-card-bg/50 p-1 rounded-lg border border-primary/20 shrink-0">
                        <button onClick={() => setActiveTab('manage')} className={`px-4 py-2 rounded-md text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all ${activeTab === 'manage' ? 'bg-primary text-black shadow-md' : 'text-text-muted hover:text-white'}`}>Active Jobs</button>
                        <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-md text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all ${activeTab === 'reports' ? 'bg-primary text-black shadow-md' : 'text-text-muted hover:text-white'}`}>Flagged Reports</button>
                    </div>
                </div>
            </header>

            {activeTab === 'manage' ? (
                <>
                    <div className="flex justify-end gap-2 mb-4">
                        <Button variant="secondary" onClick={() => setIsAISearchModalOpen(true)} className="text-xs py-2 shadow-[0_0_15px_rgba(255,165,0,0.3)] animate-pulse">✨ AI Scout</Button>
                        <Button variant="primary" onClick={() => { setInitialLinkForScraper(''); setIsAIFetchModalOpen(true); }} className="text-xs py-2">+ Create Opportunity</Button>
                    </div>

                    <Card glow="none">
                        {isLoadingOpps ? <div className="flex justify-center p-8"><Spinner /></div> : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead><tr className="border-b border-white/10 text-text-muted uppercase text-xs tracking-wider font-bold"><th className="p-3">Job / Company</th><th className="p-3">Deadline</th><th className="p-3 text-center">Applicants</th><th className="p-3 text-right">Actions</th></tr></thead>
                                        <tbody>
                                            {opportunities.length === 0 && <tr><td colSpan={4} className="text-center p-8 text-text-muted">No campus opportunities created yet.</td></tr>}
                                            {opportunities.map((opp: any) => (
                                                <tr key={opp.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                                                    <td className="p-3">
                                                        <p className="font-bold text-primary text-lg group-hover:translate-x-1 transition-transform">{opp.title}</p>
                                                        <p className="text-xs text-text-muted">{opp.company}</p>
                                                    </td>
                                                    <td className="p-3 font-mono text-secondary">{new Date(opp.deadline).toLocaleDateString()}</td>
                                                    <td className="p-3 text-center">
                                                        <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-full border border-primary/20">{opp.application_count}</span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button variant="ghost" className="text-[10px] py-1 px-3" onClick={() => {
                                                                const stages = opp.ai_analysis?.pipeline || ['Registration', 'Assessment', 'Interview', 'Offer'];
                                                                setCurrentOpp({ ...opp, pipeline_stages: stages });
                                                                setIsModalOpen(true);
                                                            }}>Edit</Button>
                                                            <Button variant="secondary" className="text-[10px] py-1 px-3" onClick={() => onNavigateToPipeline?.(opp)}>Pipeline</Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                            </>
                        )}
                    </Card>
                </>
            ) : (
                <OpportunityReports user={user} />
            )}

            {isModalOpen && currentOpp && (
                <OpportunityFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    opportunity={currentOpp}
                    onSave={(data: any) => saveMutation.mutate({ ...data, college: user.college, posted_by: user.id })}
                    isLoading={saveMutation.isPending}
                />
            )}

            <AIFetchModal
                isOpen={isAIFetchModalOpen}
                onClose={() => setIsAIFetchModalOpen(false)}
                onSuccess={handleOpenAIFilledModal}
                onSkip={handleOpenManualCreate}
                initialLink={initialLinkForScraper}
            />

            <AISearchModal
                isOpen={isAISearchModalOpen}
                onClose={() => setIsAISearchModalOpen(false)}
                onSelect={(link) => { setInitialLinkForScraper(link); setIsAIFetchModalOpen(true); }}
            />
        </div>
    );
};

const OpportunityFormModal: React.FC<any> = ({ isOpen, onClose, opportunity, onSave, isLoading }) => {
    const [formData, setFormData] = useState(opportunity);

    useEffect(() => setFormData(opportunity), [opportunity]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const addStage = () => {
        const stages = [...(formData.pipeline_stages || [])];
        stages.push('New Stage');
        setFormData({ ...formData, pipeline_stages: stages });
    };

    const updateStage = (idx: number, val: string) => {
        const stages = [...(formData.pipeline_stages || [])];
        stages[idx] = val;
        setFormData({ ...formData, pipeline_stages: stages });
    };

    const removeStage = (idx: number) => {
        const stages = [...(formData.pipeline_stages || [])].filter((_, i) => i !== idx);
        setFormData({ ...formData, pipeline_stages: stages });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={formData.id ? 'Edit Opportunity' : 'New Opportunity'}>
            <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input name="title" label="Job Title" value={formData.title} onChange={handleChange} required />
                    <Input name="company" label="Company Name" value={formData.company} onChange={handleChange} required />
                </div>

                <div>
                    <label className="block text-primary font-student-label text-sm mb-2">Job Description</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-sm text-text-base h-32 focus:outline-none"
                        required
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input name="deadline" label="Application Deadline" type="datetime-local" value={formData.deadline?.substring(0, 16)} onChange={handleChange} required />
                    <Input name="min_cgpa" label="Minimum CGPA" type="number" step="0.1" value={formData.min_cgpa} onChange={handleChange} />
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                    <h3 className="text-secondary font-display text-sm uppercase tracking-widest flex justify-between items-center">
                        <span>Hiring Pipeline</span>
                        <Button type="button" variant="ghost" className="text-[10px] py-1 h-7 border-dashed" onClick={addStage}>+ Add Stage</Button>
                    </h3>
                    <div className="space-y-2">
                        {(formData.pipeline_stages || []).map((stage: string, idx: number) => (
                            <div key={idx} className="flex gap-2 items-center group">
                                <span className="text-text-muted font-mono text-xs w-4">{idx + 1}.</span>
                                <Input
                                    value={stage}
                                    onChange={e => updateStage(idx, e.target.value)}
                                    className="!p-1.5 !text-xs"
                                    placeholder="Enter stage name (e.g. Assessment)"
                                />
                                <button type="button" onClick={() => removeStage(idx)} className="text-red-400 opacity-50 group-hover:opacity-100 transition-opacity p-1">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>
                        ))}
                        {(formData.pipeline_stages || []).length === 0 && (
                            <p className="text-xs text-text-muted italic text-center py-2">No stages defined. Using default pipeline.</p>
                        )}
                    </div>
                </div>

                <Input name="apply_link" label="External Application URL (Optional)" value={formData.apply_link} onChange={handleChange} placeholder="https://..." />

                <Button type="submit" disabled={isLoading} className="w-full mt-4 text-lg">
                    {isLoading ? <Spinner /> : formData.id ? 'Update Job' : 'Launch Job'}
                </Button>
            </form>
        </Modal>
    );
};

const AIFetchModal: React.FC<any> = ({ isOpen, onClose, onSuccess, onSkip, initialLink }) => {
    const supabase = useSupabase();
    const [url, setUrl] = useState(initialLink || '');
    const [isScraping, setIsScraping] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setUrl(initialLink || '');
            setFetchError(null);
        }
    }, [isOpen, initialLink]);

    const handleScrape = async () => {
        if (!url) return toast.error("Paste a link first.");
        setIsScraping(true);
        setFetchError(null);
        try {
            const data = await runAI({ task: 'opportunity-link-scraper', payload: { url }, supabase });

            // Check for explicit error from the Edge Function (even if status was 200)
            if (data && data.success === false) {
                setFetchError(data.message || data.error || "Analysis failed.");
            } else if (data) {
                onSuccess({ ...data, apply_link: url });
            } else {
                setFetchError("Received empty response from AI service.");
            }
        } catch (e: any) {
            console.error("[IMPORTER-ERROR]", e);
            const msg = handleAiInvocationError(e, { showToast: false });
            // If the message is generic, try to append more info from the error object
            if (e.status) {
                setFetchError(`${msg} (Status: ${e.status})`);
            } else {
                setFetchError(msg);
            }
        } finally {
            setIsScraping(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Opportunity Importer">
            <div className="space-y-6">
                {!fetchError ? (
                    <>
                        <div className="bg-primary/10 p-4 rounded-lg border border-primary/30">
                            <p className="text-sm text-text-muted leading-relaxed">
                                Paste a link from <strong className="text-white">LinkedIn, Naukri, or Unstop</strong>. Our AI will extract the description, requirements, pipeline, and deadline automatically.
                            </p>
                        </div>
                        <Input
                            label="Job Link"
                            placeholder="https://www.linkedin.com/jobs/..."
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                        />
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={onSkip} className="flex-1 text-xs">Start Manually</Button>
                            <Button variant="primary" onClick={handleScrape} disabled={isScraping} className="flex-1 text-xs">
                                {isScraping ? <Spinner /> : '⚡ Scan Link'}
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-4 space-y-4">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-white font-bold">Failed to Analyze Link</h3>
                            <p className="text-xs text-text-muted px-4 line-clamp-3">{fetchError}</p>
                        </div>
                        <div className="flex flex-col gap-2 px-4 pt-2">
                            <Button variant="primary" onClick={handleScrape} className="w-full text-xs">Try Again</Button>
                            <Button variant="ghost" onClick={onSkip} className="w-full text-xs border-white/10">Enter Manually</Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const AISearchModal: React.FC<any> = ({ isOpen, onClose, onSelect }) => {
    const supabase = useSupabase();
    const [query, setQuery] = useState({ role: '', location: '', company: '' });
    const [results, setResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSearching(true);
        try {
            const searchQuery = `${query.role} roles at ${query.company} in ${query.location}`.trim();
            const data = await runAI({ task: 'search-opportunities', payload: { query: searchQuery }, supabase });
            setResults(data.opportunities || []);
            if (data.opportunities?.length === 0) toast("No fresh matches found.", { icon: 'ℹ️' });
        } catch (e: any) {
            handleAiInvocationError(e);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Agentic Job Discovery">
            <div className="space-y-6">
                <p className="text-sm text-text-muted">The Nexus Agent will scan top job portals for high-match roles to import to your campus board.</p>
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Role" placeholder="e.g. SDE-1" value={query.role} onChange={e => setQuery({ ...query, role: e.target.value })} required />
                        <Input label="Company" placeholder="e.g. Google" value={query.company} onChange={e => setQuery({ ...query, company: e.target.value })} />
                    </div>
                    <Input label="Location" placeholder="e.g. Bangalore" value={query.location} onChange={e => setQuery({ ...query, location: e.target.value })} />
                    <Button type="submit" className="w-full" disabled={isSearching}>
                        {isSearching ? <div className="flex items-center gap-2"><Spinner className="w-4 h-4" /> Agent is Scanning...</div> : 'Start Multi-Portal Scan'}
                    </Button>
                </form>

                {results.length > 0 && (
                    <div className="space-y-3 mt-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        <h4 className="text-xs font-bold text-secondary uppercase tracking-widest border-b border-secondary/20 pb-1">Scanned Results</h4>
                        {results.map((job, i) => (
                            <div key={i} className="p-3 bg-black/40 rounded border border-white/5 flex justify-between items-center hover:border-primary/50 transition-colors">
                                <div>
                                    <p className="font-bold text-sm text-white">{job.title}</p>
                                    <p className="text-[10px] text-primary">{job.company}</p>
                                </div>
                                <Button variant="ghost" className="text-[10px] py-1 h-7" onClick={() => onSelect(job.link)}>Import</Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default OpportunityManagement;
