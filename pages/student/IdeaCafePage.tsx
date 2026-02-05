
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { StudentProfile, IdeaSubmission } from '../../types.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { runAI } from '../../services/aiClient.ts';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';

const IdeaCafePage: React.FC<{ user: StudentProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({ title: '', domain: '', problem: '', solution: '' });
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);

    const { data: history = [], isLoading: historyLoading } = useQuery({
        queryKey: ['ideaHistory', user.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('idea_submissions')
                .select('*')
                .eq('student_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as IdeaSubmission[];
        }
    });

    const brewMutation = useMutation({
        mutationFn: async () => {
            setAnalyzing(true);
            try {
                // 1. Get AI analysis
                // Fix: Added supabase client to runAI call
                const aiResult = await runAI({ task: 'analyze-idea', payload: form, supabase: supabase });

                // 2. Save to database
                const { error } = await supabase.from('idea_submissions').insert({
                    student_id: user.id,
                    title: form.title,
                    domain: form.domain,
                    problem_statement: form.problem,
                    proposed_solution: form.solution,
                    ai_analysis: aiResult
                });

                if (error) throw error;
                return aiResult;
            } finally {
                setAnalyzing(false);
            }
        },
        onSuccess: (data) => {
            setResult(data);
            toast.success("AI brewed your idea! It's saved in your history.");
            queryClient.invalidateQueries({ queryKey: ['ideaHistory', user.id] });
            setForm({ title: '', domain: '', problem: '', solution: '' });
        },
        onError: (e) => handleAiInvocationError(e)
    });

    return (
        <div className="pb-20 font-student-body">
            <header className="mb-8 text-left">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Idea Cafe
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    Founder's Deck & Launchpad. Securely validate, refine, and pitch your entrepreneurial visions.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card glow="primary" className="h-fit">
                    <h2 className="font-display text-2xl text-white mb-6">Founder's Deck</h2>
                    <form onSubmit={(e) => { e.preventDefault(); brewMutation.mutate(); }} className="space-y-4">
                        <Input label="Startup Name" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                        <Input label="Market Domain" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} required placeholder="e.g. Fintech, Edtech" />
                        <div>
                            <label className="block text-primary text-sm font-bold mb-2">The Gap (Problem)</label>
                            <textarea className="w-full bg-input-bg border-2 border-primary/30 rounded-md p-3 h-24 text-white" value={form.problem} onChange={e => setForm({ ...form, problem: e.target.value })} required />
                        </div>
                        <div>
                            <label className="block text-primary text-sm font-bold mb-2">Your Innovation (Solution)</label>
                            <textarea className="w-full bg-input-bg border-2 border-primary/30 rounded-md p-3 h-24 text-white" value={form.solution} onChange={e => setForm({ ...form, solution: e.target.value })} required />
                        </div>
                        <Button type="submit" className="w-full" disabled={analyzing}>
                            {analyzing ? <Spinner /> : 'Analyze & Save Pitch'}
                        </Button>
                    </form>
                </Card>

                <div className="space-y-6">
                    {result ? (
                        <Card glow="secondary" className="animate-fade-in-up border-secondary/50">
                            <h3 className="font-display text-2xl text-secondary mb-4">AI Analysis</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-white/5 p-4 rounded border border-white/10">
                                    <div className="text-3xl font-bold text-primary">{result.noveltyScore}%</div>
                                    <p className="text-xs text-text-muted uppercase tracking-widest leading-tight">Novelty<br />Score</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-white mb-1 text-sm">Market Insight</h4>
                                    <p className="text-sm text-text-muted">{result.marketExistence?.details}</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded border border-secondary/20">
                                    <h4 className="font-bold text-secondary mb-2 italic text-sm">AI-Generated Pitch</h4>
                                    <p className="text-sm text-white italic leading-relaxed">"{result.investorPitch}"</p>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card glow="none" className="h-64 flex flex-col items-center justify-center border-dashed border-white/10 bg-transparent text-text-muted">
                            <span className="text-4xl mb-4">💡</span>
                            <p>Enter your startup idea to receive AI validation.</p>
                        </Card>
                    )}

                    <div className="mt-8">
                        <h3 className="font-display text-xl text-white mb-4">Pitch History</h3>
                        <div className="space-y-3">
                            {historyLoading ? <Spinner /> : history.length === 0 ? <p className="text-text-muted text-sm italic">No past ideas logged.</p> : history.map(idea => (
                                <div key={idea.id} onClick={() => setResult(idea.ai_analysis)} className="bg-card-bg border border-white/10 p-3 rounded hover:border-primary transition-colors cursor-pointer flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-white text-sm">{idea.title}</p>
                                        <p className="text-[10px] text-text-muted uppercase tracking-widest">{idea.domain}</p>
                                    </div>
                                    <span className="text-[10px] text-text-muted">{new Date(idea.created_at).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IdeaCafePage;