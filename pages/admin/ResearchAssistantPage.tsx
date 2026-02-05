
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useMutation } from '@tanstack/react-query';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';
import type { AdminProfile } from '../../types.ts';
import toast from 'react-hot-toast';
import { useSupabase } from '../../contexts/SupabaseContext.tsx'; // Import useSupabase

interface ResearchAssistantPageProps {
    user: AdminProfile;
}

const ResearchAssistantPage: React.FC<ResearchAssistantPageProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'generator' | 'plagiarism'>('generator');

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="font-display text-4xl text-primary mb-2">Research Suite</h1>
                    <p className="text-text-muted">Advanced AI Tools for Academic Research & Integrity.</p>
                </div>
                <div className="flex bg-card-bg/50 p-1 rounded-lg border border-primary/20 mt-4 md:mt-0">
                    <button 
                        onClick={() => setActiveTab('generator')} 
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'generator' ? 'bg-primary text-black' : 'text-text-muted hover:text-white'}`}
                    >
                        IEEE Generator
                    </button>
                    <button 
                        onClick={() => setActiveTab('plagiarism')} 
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'plagiarism' ? 'bg-secondary text-black' : 'text-text-muted hover:text-white'}`}
                    >
                        Originality Check
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {activeTab === 'generator' ? <PaperGenerator /> : <OriginalityChecker />}
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: IEEE GENERATOR ---
const PaperGenerator = () => {
    const supabase = useSupabase(); // Use Supabase client
    const [topic, setTopic] = useState('');
    const [focus, setFocus] = useState('');
    const [result, setResult] = useState('');

    const generateMutation = useMutation({
        mutationFn: async () => {
            if(!topic) throw new Error("Topic is required");
            const res = await runAI({
                task: 'generate-research-paper',
                payload: { topic, focus },
                supabase: supabase // Fix: Added supabase client
            });
            return res.text;
        },
        onSuccess: (text) => setResult(text),
        onError: (e: any) => handleAiInvocationError(e)
    });

    const handleCopy = () => {
        navigator.clipboard.writeText(result);
        toast.success("Paper copied to clipboard!");
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card glow="primary" className="border-primary/20">
                    <h3 className="font-display text-xl text-primary mb-4">Paper Parameters</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-primary font-bold mb-2 text-sm">Research Topic</label>
                            <textarea 
                                className="w-full bg-input-bg border-2 border-primary/30 rounded-md p-3 h-24 focus:border-primary outline-none"
                                placeholder="e.g. Impact of Quantum Computing on Cryptography"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-secondary font-bold mb-2 text-sm">Specific Focus / Context</label>
                            <Input 
                                placeholder="e.g. Focus on Post-Quantum Algorithms" 
                                value={focus}
                                onChange={e => setFocus(e.target.value)}
                            />
                        </div>
                        <Button 
                            className="w-full" 
                            onClick={() => generateMutation.mutate()} 
                            disabled={generateMutation.isPending || !topic}
                        >
                            {generateMutation.isPending ? <div className="flex items-center justify-center gap-2"><Spinner className="w-4 h-4" /> Generating...</div> : 'Generate IEEE Draft'}
                        </Button>
                    </div>
                </Card>
                
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 text-sm text-text-muted">
                    <p className="font-bold text-primary mb-2">💡 Tips:</p>
                    <ul className="list-disc list-inside space-y-1">
                        <li>The output is a <strong>structured draft</strong>. Review facts carefully.</li>
                        <li>Citations are simulated placeholders. Replace with real DOI links.</li>
                        <li>Use this to overcome writer's block or structure your thoughts.</li>
                    </ul>
                </div>
            </div>

            <div className="lg:col-span-2">
                <Card glow="none" className="h-full min-h-[500px] flex flex-col border-white/10">
                    <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                        <h3 className="font-display text-lg text-white">Generated Draft</h3>
                        {result && <Button variant="ghost" onClick={handleCopy} className="text-xs h-8">Copy Markdown</Button>}
                    </div>
                    <div className="flex-1 bg-black/20 rounded-lg p-6 overflow-y-auto custom-scrollbar">
                        {generateMutation.isPending ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-70">
                                <Spinner className="w-12 h-12 mb-4" />
                                <p className="animate-pulse">Synthesizing research structure...</p>
                            </div>
                        ) : result ? (
                            <MarkdownRenderer content={result} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-50">
                                <span className="text-4xl mb-2">📄</span>
                                <p>Enter topic to generate IEEE draft.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: ORIGINALITY CHECKER ---
const OriginalityChecker = () => {
    const supabase = useSupabase(); // Use Supabase client
    const [textToCheck, setTextToCheck] = useState('');
    const [analysis, setAnalysis] = useState<any>(null);

    const checkMutation = useMutation({
        mutationFn: async () => {
            if(textToCheck.length < 50) throw new Error("Text too short (min 50 chars).");
            return await runAI({
                task: 'check-originality',
                payload: { text: textToCheck },
                supabase: supabase // Fix: Added supabase client
            });
        },
        onSuccess: (data) => setAnalysis(data),
        onError: (e: any) => handleAiInvocationError(e)
    });

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400';
        if (score >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="flex flex-col gap-4">
                <Card glow="secondary" className="flex-1 flex flex-col border-secondary/20">
                    <h3 className="font-display text-xl text-secondary mb-4">Content Input</h3>
                    <textarea 
                        className="flex-1 w-full bg-input-bg border-2 border-secondary/30 rounded-md p-4 text-base focus:border-secondary outline-none resize-none mb-4"
                        placeholder="Paste abstract, essay, or research text here to check for AI patterns and originality..."
                        value={textToCheck}
                        onChange={e => setTextToCheck(e.target.value)}
                    />
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted">{textToCheck.length} chars</span>
                        <Button 
                            variant="secondary" 
                            onClick={() => checkMutation.mutate()} 
                            disabled={checkMutation.isPending || !textToCheck}
                        >
                            {checkMutation.isPending ? <Spinner /> : 'Audit Originality'}
                        </Button>
                    </div>
                </Card>
            </div>

            <div>
                <Card glow="none" className="h-full border-white/10 bg-gradient-to-br from-card-bg to-secondary/5">
                    <h3 className="font-display text-xl text-white mb-6 border-b border-white/10 pb-2">Audit Report</h3>
                    
                    {checkMutation.isPending ? (
                        <div className="flex flex-col items-center justify-center h-64">
                            <div className="relative w-24 h-24 mb-4">
                                <div className="absolute inset-0 border-4 border-secondary/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-secondary rounded-full animate-spin"></div>
                            </div>
                            <p className="text-secondary animate-pulse">Analyzing syntax patterns & burstiness...</p>
                        </div>
                    ) : analysis ? (
                        <div className="space-y-8 animate-fade-in-up">
                            {/* Score Gauge */}
                            <div className="flex flex-col items-center">
                                <div className="relative w-40 h-40 flex items-center justify-center">
                                    <svg className="w-full h-full" viewBox="0 0 36 36">
                                        <path
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="#444"
                                            strokeWidth="2"
                                        />
                                        <path
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke={analysis.score >= 80 ? '#4ade80' : analysis.score >= 50 ? '#facc15' : '#f87171'}
                                            strokeWidth="2"
                                            strokeDasharray={`${analysis.score}, 100`}
                                            className="animate-[spin_1s_ease-out_reverse]"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className={`text-4xl font-bold ${getScoreColor(analysis.score)}`}>{analysis.score}%</span>
                                        <span className="text-[10px] text-text-muted uppercase">Originality</span>
                                    </div>
                                </div>
                                <p className={`mt-2 text-xl font-display ${getScoreColor(analysis.score)}`}>{analysis.verdict}</p>
                            </div>

                            {/* Analysis Text */}
                            <div className="bg-black/30 p-4 rounded-lg border border-white/5">
                                <h4 className="text-sm font-bold text-white mb-2">AI Assessment:</h4>
                                <p className="text-text-base leading-relaxed">{analysis.analysis}</p>
                            </div>

                            {/* Flags */}
                            {analysis.flags && analysis.flags.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-red-400 mb-2">Flagged Patterns:</h4>
                                    <ul className="space-y-2">
                                        {analysis.flags.map((flag: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                                                <span className="text-red-500 mt-1">⚠️</span> {flag}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-text-muted opacity-50 text-center px-8">
                            <span className="text-4xl mb-4">🛡️</span>
                            <p>Submit text to check for AI generation and originality.</p>
                            <p className="text-xs mt-2 text-secondary">Note: This is an AI-based probability estimate, not a database plagiarism search.</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ResearchAssistantPage;