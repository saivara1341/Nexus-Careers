
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useMutation } from '@tanstack/react-query';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';
import toast from 'react-hot-toast';

type AIMode = 'standard' | 'research' | 'audit' | 'circular' | 'mom' | 'idf';

const AIMentorPage: React.FC = () => {
    const supabase = useSupabase();
    const [mode, setMode] = useState<AIMode>('standard');
    const [showIntro, setShowIntro] = useState(true);
    const [result, setResult] = useState<any>(null);

    // Universal form states
    const [formData, setFormData] = useState<any>({});

    const aiMutation = useMutation({
        mutationFn: async () => {
            let task = '';
            let payload: any = {};

            switch (mode) {
                case 'idf':
                    task = 'generate-idf';
                    payload = formData;
                    break;
                case 'research':
                    task = 'generate-research-paper';
                    payload = { topic: formData.topic, focus: formData.focus };
                    break;
                case 'audit':
                    task = 'check-originality';
                    payload = { text: formData.content };
                    break;
                case 'circular':
                    task = 'structured-circular';
                    payload = formData;
                    break;
                case 'mom':
                    task = 'generate-mom';
                    payload = { notes: formData.content, title: formData.title };
                    break;
                default:
                    task = 'chat';
                    payload = { message: formData.content, history: [] };
            }

            return await runAI({ task, payload, supabase });
        },
        onSuccess: (data) => {
            setResult(data);
            toast.success("AI Synthesis Complete!", { icon: '🧠' });
        },
        onError: (error) => handleAiInvocationError(error)
    });

    const reset = () => {
        setResult(null);
        setFormData({});
    };

    const handleInpChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (showIntro) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4">
                <header className="mb-12 text-center">
                    <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                        AI Mentor Hub
                    </h1>
                    <p className="text-text-muted text-sm font-mono max-w-2xl italic mx-auto">
                        State-of-the-art institutional intelligence for research, administration, and legal drafting.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
                    <ModeCard
                        icon="💡"
                        title="IDF Patent Architect"
                        desc="Draft Invention Disclosure Forms for patenting entrepreneurship ideas."
                        onClick={() => { setMode('idf'); setShowIntro(false); }}
                        variant="primary"
                    />
                    <ModeCard
                        icon="📢"
                        title="Circular Architect"
                        desc="Generate authoritative university notices for Industry Alliances and Departments."
                        onClick={() => { setMode('circular'); setShowIntro(false); }}
                        variant="secondary"
                    />
                    <ModeCard
                        icon="🔬"
                        title="Academic Research"
                        desc="Generate comprehensive IEEE-standard drafts and structured reviews."
                        onClick={() => { setMode('research'); setShowIntro(false); }}
                        variant="primary"
                    />
                    <ModeCard
                        icon="🛡️"
                        title="Originality Guardian"
                        desc="Deep semantic analysis for AI probability detection and syntax auditing."
                        onClick={() => { setMode('audit'); setShowIntro(false); }}
                        variant="secondary"
                    />
                    <ModeCard
                        icon="📝"
                        title="MoM Structurer"
                        desc="Transform unstructured meeting transcripts into actionable Minutes of Meeting."
                        onClick={() => { setMode('mom'); setShowIntro(false); }}
                        variant="primary"
                    />
                    <ModeCard
                        icon="⚡"
                        title="Universal Core"
                        desc="General-purpose intelligent assistant for academic planning."
                        onClick={() => { setMode('standard'); setShowIntro(false); }}
                        variant="secondary"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col font-body">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-black tracking-tighter uppercase mb-1">
                            <span className="text-primary opacity-50 mr-2">#</span>
                            <span className="text-primary">
                                {mode === 'idf' && 'IDF Patent Architect'}
                                {mode === 'research' && 'Academic Research'}
                                {mode === 'audit' && 'Originality Guardian'}
                                {mode === 'circular' && 'Circular Architect'}
                                {mode === 'mom' && 'MoM Engine'}
                                {mode === 'standard' && 'Intelligence Core'}
                            </span>
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-[10px] text-text-muted font-mono tracking-widest uppercase">System Active // {mode.toUpperCase()}</p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={() => { setShowIntro(true); reset(); }} className="text-xs border-white/10 hover:border-primary/50 group shrink-0">
                        <span className="group-hover:-translate-x-1 transition-transform inline-block mr-1">←</span> Switch Module
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0 pb-10">
                {/* Input Panel */}
                <div className="lg:col-span-4 h-full overflow-y-auto pr-2 custom-scrollbar">
                    <Card glow="primary" className="h-fit space-y-6 bg-card-bg/40 border-primary/20 p-8">
                        <h3 className="text-xs font-black text-text-muted uppercase tracking-[0.4em] border-b border-white/5 pb-4">Document Fields</h3>

                        {mode === 'idf' && (
                            <div className="space-y-4">
                                <Input label="Invention Title" name="title" value={formData.title || ''} onChange={handleInpChange} placeholder="e.g. Make My Plan AI" />
                                <div className="grid grid-cols-2 gap-3">
                                    <Input label="Student Name" name="studentName" value={formData.studentName || ''} onChange={handleInpChange} placeholder="Full Name" />
                                    <Input label="Roll Number" name="rollNo" value={formData.rollNo || ''} onChange={handleInpChange} placeholder="22EG..." />
                                </div>
                                <Input label="Faculty In Charge" name="faculty" value={formData.faculty || ''} onChange={handleInpChange} placeholder="Designation & Name" />
                                <div>
                                    <label className="block text-primary font-student-label text-sm mb-2">Main Objective</label>
                                    <textarea name="objective" className="w-full bg-black/40 border-2 border-primary/30 rounded-lg p-3 text-sm h-24 focus:border-primary outline-none" placeholder="What does it achieve?" value={formData.objective || ''} onChange={handleInpChange} />
                                </div>
                                <div>
                                    <label className="block text-secondary font-student-label text-sm mb-2">Novelty Factor</label>
                                    <textarea name="novelty" className="w-full bg-black/40 border-2 border-secondary/30 rounded-lg p-3 text-sm h-24 focus:border-secondary outline-none" placeholder="What is unique about this?" value={formData.novelty || ''} onChange={handleInpChange} />
                                </div>
                            </div>
                        )}

                        {mode === 'circular' && (
                            <div className="space-y-4">
                                <Input label="Issuing Office" name="office" value={formData.office || ''} onChange={handleInpChange} placeholder="e.g. Office of Industry Alliances" />
                                <Input label="Reference No" name="refNo" value={formData.refNo || ''} onChange={handleInpChange} placeholder="Cir. No: AU/TD/2025/..." />
                                <Input label="Subject Title" name="subject" value={formData.subject || ''} onChange={handleInpChange} placeholder="Subject of circular" />
                                <Input label="Target Audience" name="target" value={formData.target || ''} onChange={handleInpChange} placeholder="e.g. IV B.Tech Students" />
                                <Input label="Specific Date/Deadline" name="deadline" value={formData.deadline || ''} onChange={handleInpChange} placeholder="e.g. 24th Nov 2025" />
                                <div>
                                    <label className="block text-primary font-student-label text-sm mb-2">Main Notice Body</label>
                                    <textarea name="content" className="w-full bg-black/40 border-2 border-primary/30 rounded-lg p-3 text-sm h-32 focus:border-primary outline-none" placeholder="Core information for the circular..." value={formData.content || ''} onChange={handleInpChange} />
                                </div>
                            </div>
                        )}

                        {mode === 'research' && (
                            <div className="space-y-4">
                                <Input label="Topic" name="topic" value={formData.topic || ''} onChange={handleInpChange} placeholder="e.g. LLMs in Healthcare" />
                                <div>
                                    <label className="block text-primary font-student-label text-sm mb-2">Focus Area</label>
                                    <textarea name="focus" className="w-full bg-black/40 border-2 border-primary/30 rounded-lg p-3 text-sm h-32 focus:border-primary outline-none" placeholder="Objectives, methodologies..." value={formData.focus || ''} onChange={handleInpChange} />
                                </div>
                            </div>
                        )}

                        {mode === 'audit' && (
                            <div className="space-y-4">
                                <label className="block text-primary font-student-label text-sm">Payload Content</label>
                                <textarea name="content" className="w-full bg-black/40 border-2 border-secondary/30 rounded-lg p-4 text-sm h-[400px] focus:border-secondary outline-none font-mono" placeholder="Paste research text here..." value={formData.content || ''} onChange={handleInpChange} />
                            </div>
                        )}

                        {mode === 'mom' && (
                            <div className="space-y-4">
                                <Input label="Subject" name="title" value={formData.title || ''} onChange={handleInpChange} placeholder="HOD Meeting Q3" />
                                <div>
                                    <label className="block text-primary font-student-label text-sm mb-2">Meeting Nodes</label>
                                    <textarea name="content" className="w-full bg-black/40 border-2 border-secondary/30 rounded-lg p-3 text-sm h-64 focus:border-secondary outline-none" placeholder="Paste raw notes..." value={formData.content || ''} onChange={handleInpChange} />
                                </div>
                            </div>
                        )}

                        {mode === 'standard' && (
                            <div className="space-y-4">
                                <label className="block text-primary font-student-label text-sm mb-2">Universal Command</label>
                                <textarea name="content" className="w-full bg-black/40 border-2 border-primary/30 rounded-lg p-4 text-sm h-64 focus:border-primary outline-none" placeholder="What can Nexus help with?" value={formData.content || ''} onChange={handleInpChange} />
                            </div>
                        )}

                        <Button
                            onClick={() => aiMutation.mutate()}
                            disabled={aiMutation.isPending}
                            className="w-full shadow-primary py-4 uppercase font-bold tracking-widest text-sm"
                        >
                            {aiMutation.isPending ? <div className="flex items-center gap-3 justify-center"><Spinner className="w-5 h-5" /> <span>Thinking...</span></div> : 'Draft Document'}
                        </Button>
                    </Card>
                </div>

                {/* Output Panel */}
                <div className="lg:col-span-8 h-full overflow-hidden">
                    <Card glow="none" className="h-full flex flex-col border-white/10 bg-black/40 overflow-hidden p-0">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <span className="text-[10px] text-text-muted uppercase tracking-[0.3em] font-black">AI Document Output</span>
                            {result && (
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(result.text || JSON.stringify(result));
                                        toast.success("Output Logged to Clipboard");
                                    }}
                                    className="text-[10px] text-primary font-bold hover:text-white transition-colors flex items-center gap-1"
                                >
                                    Copy Markdown
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {aiMutation.isPending ? (
                                <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-6">
                                    <div className="relative w-20 h-20">
                                        <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
                                    </div>
                                    <p className="font-display text-xl text-primary animate-pulse tracking-tighter">Drafting institutional nodes...</p>
                                </div>
                            ) : result ? (
                                <div className="animate-fade-in-up prose prose-invert max-w-none">
                                    {mode === 'audit' ? <OriginalityReport data={result} /> : <MarkdownRenderer content={result.text} />}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-10 space-y-4">
                                    <span className="text-9xl">🖋️</span>
                                    <p className="font-display text-2xl tracking-widest uppercase">Select module to begin</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const ModeCard = ({ icon, title, desc, onClick, variant }: { icon: string, title: string, desc: string, onClick: () => void, variant: 'primary' | 'secondary' }) => (
    <button
        onClick={onClick}
        className={`bg-card-bg/60 backdrop-blur-xl border border-white/5 p-6 rounded-2xl hover:bg-white/5 transition-all text-left group relative overflow-hidden flex flex-col h-full`}
    >
        <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] transition-all duration-500 group-hover:scale-150 ${variant === 'primary' ? 'bg-primary/10' : 'bg-secondary/10'}`}></div>

        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg ${variant === 'primary' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border border-secondary/30'}`}>
            <span className="text-2xl">{icon}</span>
        </div>

        <h3 className="font-display text-xl text-white mb-2 tracking-tight group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-xs text-text-muted leading-relaxed flex-grow">{desc}</p>

        <div className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
            Initialize <span className="text-lg leading-none">→</span>
        </div>
    </button>
);

const OriginalityReport = ({ data }: { data: any }) => (
    <div className="space-y-8 animate-fade-in-up">
        <div className="flex flex-col items-center">
            <div className="relative w-56 h-56">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#111" strokeWidth="2.5" />
                    <circle
                        cx="18" cy="18" r="15.9155" fill="none"
                        stroke={data.score > 70 ? "#4ade80" : data.score > 40 ? "#fbbf24" : "#f87171"}
                        strokeWidth="2.5" strokeDasharray={`${data.score}, 100`}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-mono font-bold text-white">{data.score}%</span>
                    <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black mt-1">Unique Score</span>
                </div>
            </div>
            <p className={`mt-6 text-2xl font-display font-bold ${data.score > 70 ? 'text-green-400' : 'text-red-400'}`}>{data.verdict}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/30 p-6 rounded-xl border border-white/10 h-full">
                <h4 className="text-xs font-black text-secondary uppercase tracking-[0.2em] mb-4">Linguistic Analysis</h4>
                <p className="text-sm text-text-base leading-relaxed opacity-80">{data.analysis}</p>
            </div>

            <div className="space-y-4">
                <h4 className="text-xs font-black text-red-400 uppercase tracking-[0.2em]">Integrity Flags</h4>
                {data.flags?.length > 0 ? (
                    <div className="space-y-2">
                        {data.flags.map((f: string, i: number) => (
                            <div key={i} className="text-xs bg-red-500/5 border border-red-500/20 p-3 rounded-lg text-red-300 flex items-center gap-3">
                                <span className="text-lg">⚠️</span> {f}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 text-green-400 text-xs font-bold flex items-center gap-2">
                        <span>✓</span> No linguistic markers for AI detected.
                    </div>
                )}
            </div>
        </div>
    </div>
);

export default AIMentorPage;
