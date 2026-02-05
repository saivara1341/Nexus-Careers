
import React, { useState, useMemo, useEffect } from 'react';
import type { Opportunity, StudentProfile, Application } from '../../types.ts';
import { normalizeDepartmentName } from '../../types.ts'; // Import normalizeDepartmentName
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { OpportunityDetailModal } from '../../components/student/OpportunityDetailModal.tsx';
import { ReportOpportunityModal } from '../../components/student/ReportOpportunityModal.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { SkeletonCard } from '../../components/ui/SkeletonCard.tsx';
import { runAI } from '../../services/aiClient.ts';
import { Modal } from '../../components/ui/Modal.tsx';

interface OpportunityBoardProps {
    user: StudentProfile;
}

export const PAGE_SIZE = 18;

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
}

const fetchOpportunitiesAndApplications = async (supabase, user: StudentProfile, page: number, searchTerm: string): Promise<{ opportunities: Opportunity[]; myApplications: Set<string>; count: number }> => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const today = new Date().toISOString();

    // Normalize user's department name for consistent comparison
    const normalizedUserDepartment = normalizeDepartmentName(user.department);

    let oppsQuery = supabase
        .from('opportunities')
        .select('*', { count: 'exact' })
        .eq('college', user.college)
        .eq('status', 'active')
        .gte('deadline', today)
        // Basic eligibility filtering on DB side
        .lte('min_cgpa', user.ug_cgpa)
        // Use normalized department in the .cs operator
        .cs('allowed_departments', `{All,${normalizedUserDepartment}}`);

    if (searchTerm) {
        oppsQuery = oppsQuery.or(`title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`);
    }

    // Execute both queries in parallel
    const [opportunitiesResponse, applicationsResponse] = await Promise.all([
        oppsQuery.order('created_at', { ascending: false }).range(from, to),
        supabase.from('applications').select('opportunity_id').eq('student_id', user.id)
    ]);

    const { data: oppsData, error: oppsError, count: dbCount } = opportunitiesResponse;
    const { data: appsData, error: appsError } = applicationsResponse;

    if (oppsError) { handleAiInvocationError(oppsError); throw new Error(oppsError.message); }
    if (appsError) { handleAiInvocationError(appsError); throw new Error(appsError.message); }

    return {
        opportunities: oppsData as Opportunity[] || [],
        myApplications: new Set((appsData || []).map(app => app.opportunity_id)),
        count: dbCount || 0
    };
};

const logApplication = async (supabase, { userId, oppId }: { userId: string, oppId: string }) => {
    const { error } = await supabase.from('applications').insert({ student_id: userId, opportunity_id: oppId });
    if (error) { handleAiInvocationError(error); throw error; }
};

const OpportunityBoard: React.FC<OpportunityBoardProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isAISearchModalOpen, setIsAISearchModalOpen] = useState(false);
    const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
    const [isMatching, setIsMatching] = useState(false);
    const [refreshCountdown, setRefreshCountdown] = useState<string>('');

    // Advanced Filters
    const [minPackage, setMinPackage] = useState<number | ''>('');
    const [jobType, setJobType] = useState<'all' | 'intern' | 'fulltime'>('all');

    const { data: opportunitiesBoardData, isLoading } = useQuery({
        queryKey: ['opportunities', user.id, page, debouncedSearchTerm],
        queryFn: () => fetchOpportunitiesAndApplications(supabase, user, page, debouncedSearchTerm),
        placeholderData: (prev) => prev,
    });

    const rawOpportunities = opportunitiesBoardData?.opportunities ?? [];
    const myApplications = opportunitiesBoardData?.myApplications ?? new Set();

    // Client-side filtering for advanced fields not easily queryable without complex SQL
    const opportunities = useMemo(() => {
        return rawOpportunities.filter(opp => {
            const matchesPackage = minPackage === '' || (opp.package_lpa || 0) >= minPackage;
            const titleLower = opp.title.toLowerCase();
            const isIntern = titleLower.includes('intern');
            const matchesType = jobType === 'all' || (jobType === 'intern' ? isIntern : !isIntern);
            return matchesPackage && matchesType;
        });
    }, [rawOpportunities, minPackage, jobType]);

    // AI Matchmaking Effect with Weekly Refresh & Persistence
    useEffect(() => {
        if (rawOpportunities.length > 0 && !isMatching) {
            const getRecommendations = async () => {
                setIsMatching(true);
                try {
                    // 1. Check for existing recommendations in the DB
                    const { data: existingRecs, error: fetchError } = await supabase
                        .from('student_recommendations')
                        .select('*')
                        .eq('student_id', user.id)
                        .gt('expires_at', new Date().toISOString())
                        .single();

                    if (!fetchError && existingRecs) {
                        setAiRecommendations(existingRecs.recommendations);

                        // Set countdown
                        const expires = new Date(existingRecs.expires_at).getTime();
                        const now = new Date().getTime();
                        const diff = expires - now;
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                        setRefreshCountdown(`${days}d left`);
                        setIsMatching(false);
                        return;
                    }

                    // 2. If none or expired, generate new ones via AI
                    const result = await runAI({
                        task: 'job-matchmaking',
                        payload: {
                            student: {
                                name: user.name,
                                skills: user.skills,
                                department: user.department,
                                cgpa: user.ug_cgpa,
                                projects: user.project_details,
                                experience: user.experience_details
                            },
                            jobs: rawOpportunities.slice(0, 20).map(o => ({ id: o.id, title: o.title, company: o.company, desc: o.description }))
                        },
                        supabase
                    });

                    if (result?.recommendations) {
                        const newRecs = result.recommendations.slice(0, 3); // Pick top 3 for Elite section
                        setAiRecommendations(newRecs);

                        // 3. Persist to DB for 7 days
                        const expiresAt = new Date();
                        expiresAt.setDate(expiresAt.getDate() + 7);

                        // Cleanup old ones first
                        await supabase.from('student_recommendations').delete().eq('student_id', user.id);

                        // Insert new
                        await supabase.from('student_recommendations').insert({
                            student_id: user.id,
                            recommendations: newRecs,
                            expires_at: expiresAt.toISOString()
                        });

                        setRefreshCountdown('7d left');
                    }
                } catch (e) {
                    console.error("Matchmaking failed", e);
                } finally {
                    setIsMatching(false);
                }
            };
            getRecommendations();
        }
    }, [rawOpportunities.length, user, supabase]);

    const count = opportunitiesBoardData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const applyMutation = useMutation({
        mutationFn: (vars: { userId: string, oppId: string }) => logApplication(supabase, vars),
        onSuccess: () => {
            toast.success("Application logged! Upload proof in 'My Applications' to earn XP.");
            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        },
        onError: (error) => handleAiInvocationError(error),
    });

    const autoApplyMutation = useMutation({
        mutationFn: async (opp: Opportunity) => {
            // 1. Generate tailored pitch
            const { pitch } = await runAI({
                task: 'application-tailoring',
                payload: {
                    student: { name: user.name, skills: user.skills, cgpa: user.ug_cgpa },
                    job: { title: opp.title, company: opp.company, description: opp.description }
                },
                supabase
            });

            // 2. Insert application with metadata
            const { error } = await supabase.from('applications').insert({
                student_id: user.id,
                opportunity_id: opp.id,
                status: 'applied',
                metadata: { auto_applied: true, ai_pitch: pitch, handpicked: true }
            });

            if (error) throw error;

            // 3. Award XP for handpicked application
            await supabase.rpc('award_xp', { user_id: user.id, xp_amount: 50 });

            return { pitch };
        },
        onSuccess: (data) => {
            toast.success("Elite Match Applied! +50 XP Earned.", { icon: '✨' });
            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        },
        onError: (e) => toast.error("Auto-Apply failed: " + e.message)
    });

    // Improved Match Score Calculation
    const getMatchScore = (opp: Opportunity) => {
        let score = 50; // Base score

        // 1. Department Match (20%)
        // Ensure consistent casing for comparison
        const normalizedUserDepartment = normalizeDepartmentName(user.department);
        if (opp.allowed_departments.includes(normalizedUserDepartment || '') || opp.allowed_departments.includes('All')) score += 20;

        // 2. CGPA Buffer (10%)
        if (user.ug_cgpa >= opp.min_cgpa + 1.0) score += 10;
        else if (user.ug_cgpa >= opp.min_cgpa + 0.5) score += 5;

        // 3. Skills Match (20%) - NEW AI Feature
        const jobSkills = opp.ai_analysis?.key_skills?.map(s => s.toLowerCase()) || [];
        const studentSkills = user.skills?.map(s => s.toLowerCase()) || [];

        if (jobSkills.length > 0 && studentSkills.length > 0) {
            const matchedSkills = jobSkills.filter(skill => studentSkills.some(studentSkill => studentSkill.includes(skill) || skill.includes(studentSkill)));
            const skillRatio = Math.min(matchedSkills.length / Math.min(jobSkills.length, 5), 1); // Cap at 100% of weight
            score += Math.round(skillRatio * 20);
        }

        return Math.min(100, score);
    };

    return (
        <div className="pb-24">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Job Board
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            Internal and institution-approved opportunities prioritized for your career growth.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-grow md:justify-end mt-2 md:mt-0">
                        <Button variant="secondary" onClick={() => setIsAISearchModalOpen(true)} className="whitespace-nowrap shadow-[0_0_20px_rgb(var(--color-secondary-rgb)/0.4)] animate-pulse text-xs md:text-sm">
                            🌐 Agentic Job Search
                        </Button>
                        <div className="relative w-full md:w-64">
                            <Input
                                placeholder="Search internal jobs..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 text-sm"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                </div>

                {/* Smart Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-4 bg-card-bg/50 p-3 rounded-lg border border-primary/20 backdrop-blur-md mt-6">
                    <span className="text-sm font-display text-text-muted uppercase tracking-wider flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                        Filters:
                    </span>

                    <div className="flex items-center gap-2">
                        <select
                            value={jobType}
                            onChange={e => setJobType(e.target.value as any)}
                            className="bg-black/30 border border-white/10 rounded px-2 py-1 text-xs md:text-sm focus:border-primary outline-none text-text-base w-full md:w-auto"
                        >
                            <option value="all">All Types</option>
                            <option value="intern">Internships</option>
                            <option value="fulltime">Full Time</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted hidden md:inline">Min Package:</span>
                        <Input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="LPA"
                            value={minPackage}
                            onChange={e => setMinPackage(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-20 text-xs md:text-sm py-1 h-8 bg-black/30 border-white/10"
                        />
                    </div>

                    <div className="ml-auto text-xs text-text-muted">
                        {opportunities.length} jobs
                    </div>
                </div>
            </header>

            {/* AI Recommendations Section */}
            {
                aiRecommendations.length > 0 && (
                    <div className="mb-10 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-secondary animate-pulse">magic_button</span>
                                <h2 className="font-display text-xl text-white uppercase tracking-tighter">Hand-picked for You</h2>
                                <span className="text-[10px] bg-secondary/20 text-secondary px-2 py-0.5 rounded-full font-bold ml-2">AI ELITE DECK</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-text-muted font-mono bg-white/5 px-2 py-1 rounded border border-white/10">
                                <span className="material-symbols-outlined text-[12px]">update</span>
                                REFRESHES IN: <span className="text-secondary font-bold">{refreshCountdown}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {aiRecommendations.map((rec) => {
                                const opp = rawOpportunities.find(o => o.id === rec.jobId);
                                if (!opp) return null;
                                const applied = myApplications.has(opp.id);
                                return (
                                    <Card key={rec.jobId} glow="secondary" className="border-secondary/30 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 bg-secondary text-black text-[10px] font-black px-2 py-1 rounded-bl-lg">
                                            {rec.matchScore}% MATCH
                                        </div>
                                        <div className="pt-2">
                                            <h3 className="font-display text-lg text-white truncate pr-16">{opp.title}</h3>
                                            <p className="text-secondary text-sm font-bold mb-3">{opp.company}</p>
                                            <div className="bg-black/40 p-3 rounded-lg border border-white/5 mb-4">
                                                <p className="text-[10px] text-text-muted italic leading-tight">
                                                    <span className="text-secondary mr-1">AI Reason:</span> {rec.reasoning}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="secondary"
                                                    className="flex-1 text-xs h-9 uppercase font-black tracking-widest"
                                                    disabled={applied || autoApplyMutation.isPending}
                                                    onClick={() => autoApplyMutation.mutate(opp)}
                                                >
                                                    {autoApplyMutation.isPending && autoApplyMutation.variables?.id === opp.id ? (
                                                        <Spinner className="w-4 h-4" />
                                                    ) : applied ? (
                                                        'Applied'
                                                    ) : (
                                                        'Auto-Apply'
                                                    )}
                                                </Button>
                                                <Button variant="ghost" className="text-xs h-9 w-9 rounded-full p-0 flex items-center justify-center border-white/10" onClick={() => setSelectedOpp(opp)}>
                                                    <span className="material-symbols-outlined text-sm">visibility</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            {
                isLoading && !opportunitiesBoardData ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {opportunities.length === 0 && <p className="text-center text-lg text-text-muted col-span-full py-12">No matching opportunities found. Try adjusting filters.</p>}
                            {opportunities.map((opp, index) => {
                                const matchScore = getMatchScore(opp);
                                const applied = myApplications.has(opp.id);

                                return (
                                    <Card
                                        key={opp.id}
                                        className={`border-primary/30 flex flex-col opacity-0 animate-fade-in-up relative overflow-hidden group hover:border-primary transition-all duration-300`}
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        {/* Match Score Indicator */}
                                        <div className="absolute top-0 right-0 bg-black/40 backdrop-blur-md px-3 py-1 rounded-bl-lg border-b border-l border-white/10 z-10 flex items-center gap-1">
                                            <span className="text-[10px] text-text-muted uppercase">Match</span>
                                            <span className={`text-sm font-bold ${matchScore >= 90 ? 'text-green-400' : matchScore >= 75 ? 'text-secondary' : 'text-text-muted'}`}>
                                                {matchScore}%
                                            </span>
                                        </div>

                                        <div className="flex-grow pt-4">
                                            <h2 className="font-display text-xl md:text-2xl text-primary truncate pr-16">{opp.title}</h2>
                                            <h3 className="text-base md:text-lg text-white mb-2">{opp.company}</h3>

                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {opp.package_lpa && <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded border border-green-500/20 font-mono">₹{opp.package_lpa} LPA</span>}
                                                <span className="bg-secondary/10 text-secondary text-xs px-2 py-1 rounded border border-secondary/20">{opp.allowed_departments.includes('All') ? 'All Depts' : opp.allowed_departments[0]}</span>
                                            </div>

                                            <p className="text-text-muted text-sm line-clamp-3 mb-4">{opp.description}</p>
                                        </div>

                                        <div className="flex justify-between items-center mt-auto pt-4 border-t border-primary/20">
                                            <span className="text-xs text-text-muted">Deadline: {new Date(opp.deadline).toLocaleDateString()}</span>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" className="text-xs h-8 px-2" onClick={() => setSelectedOpp(opp)}>Details</Button>
                                                <Button
                                                    onClick={() => applyMutation.mutate({ userId: user.id, oppId: opp.id })}
                                                    disabled={applied || applyMutation.isPending}
                                                    className={`text-xs h-8 px-3 ${applied ? 'bg-green-500/20 text-green-400 border-green-500/50' : ''}`}
                                                >
                                                    {applied ? 'Applied ✓' : 'Apply'}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </>
                )
            }

            {selectedOpp && <OpportunityDetailModal isOpen={!!selectedOpp} onClose={() => setSelectedOpp(null)} opportunity={selectedOpp} />}
            {selectedOpp && <ReportOpportunityModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} opportunity={selectedOpp} user={user} />}
            <AISearchModal isOpen={isAISearchModalOpen} onClose={() => setIsAISearchModalOpen(false)} />
        </div >
    );
};

// Reused AI Search Modal for Students with Advanced Filters
const AISearchModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const supabase = useSupabase();
    const [searchParams, setSearchParams] = useState({
        role: '',
        location: '',
        company: '',
        type: 'Any',
        experience: 'Any',
        salary: ''
    });

    const searchMutation = useMutation({
        mutationFn: async (searchQuery: string) => {
            return await runAI({ task: 'search-opportunities', payload: { query: searchQuery }, supabase });
        },
        onError: (error: any) => handleAiInvocationError(error)
    });

    const results = searchMutation.data?.opportunities || [];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const parts = [];
        if (searchParams.role) parts.push(`${searchParams.role} roles`);
        if (searchParams.company) parts.push(`at ${searchParams.company}`);
        if (searchParams.location) parts.push(`in ${searchParams.location}`);
        if (searchParams.type !== 'Any') parts.push(`(${searchParams.type})`);
        if (searchParams.experience !== 'Any') parts.push(`for ${searchParams.experience} level`);
        if (searchParams.salary) parts.push(`salary around ${searchParams.salary}`);

        const finalQuery = parts.join(' ');
        if (!finalQuery.trim()) { toast.error("Please enter at least a role or company."); return; }

        searchMutation.mutate(finalQuery);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Agentic Job Search">
            <div className="space-y-4">
                <p className="text-sm text-text-muted">
                    The AI Agent will actively scan external portals like <strong className="text-white">LinkedIn, Naukri, Internshala, and Unstop</strong> to find real-time opportunities matching your preferences.
                </p>
                <form onSubmit={handleSearch} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <Input label="Role / Job Title" placeholder="e.g. React Developer" value={searchParams.role} onChange={e => setSearchParams({ ...searchParams, role: e.target.value })} required />
                        </div>
                        <Input label="Company (Optional)" placeholder="e.g. Google" value={searchParams.company} onChange={e => setSearchParams({ ...searchParams, company: e.target.value })} />
                        <Input label="Location (Optional)" placeholder="e.g. Bangalore" value={searchParams.location} onChange={e => setSearchParams({ ...searchParams, location: e.target.value })} />

                        <div className="space-y-1">
                            <label className="block text-primary font-display text-sm">Job Type</label>
                            <select
                                value={searchParams.type}
                                onChange={e => setSearchParams({ ...searchParams, type: e.target.value })}
                                className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-2 text-sm text-text-base focus:outline-none"
                            >
                                <option value="Any">Any</option>
                                <option value="Remote">Remote</option>
                                <option value="Hybrid">Hybrid</option>
                                <option value="On-site">On-site</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-primary font-display text-sm">Experience Level</label>
                            <select
                                value={searchParams.experience}
                                onChange={e => setSearchParams({ ...searchParams, experience: e.target.value })}
                                className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-2 text-sm text-text-base focus:outline-none"
                            >
                                <option value="Any">Any</option>
                                <option value="Internship">Internship</option>
                                <option value="Entry Level">Entry Level</option>
                                <option value="Associate">Associate</option>
                                <option value="Mid-Senior">Mid-Senior</option>
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <Input label="Salary Range (Optional)" placeholder="e.g. 5-10 LPA" value={searchParams.salary} onChange={e => setSearchParams({ ...searchParams, salary: e.target.value })} />
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={searchMutation.isPending}>
                        {searchMutation.isPending ? <div className="flex items-center gap-2"><Spinner className="w-4 h-4" /> Agent is Scanning Portals...</div> : 'Find Matches'}
                    </Button>
                </form>

                {results.length > 0 && (
                    <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                        <h4 className="text-sm font-bold text-white uppercase border-b border-white/10 pb-1">Found {results.length} Matches</h4>
                        {results.map((job: any, index: number) => (
                            <div key={index} className="bg-card-bg/50 p-3 rounded border border-primary/20 hover:border-primary/50 transition-colors">
                                <h4 className="font-bold text-primary">{job.title}</h4>
                                <p className="text-sm text-secondary">{job.company}</p>
                                <p className="text-xs text-text-muted mt-1 line-clamp-2">{job.summary}</p>
                                <div className="mt-2 flex justify-between items-center">
                                    <a href={job.link} target="_blank" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                        View Posting <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default OpportunityBoard;
