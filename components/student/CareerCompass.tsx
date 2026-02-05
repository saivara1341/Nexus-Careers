import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { runAI } from '../../services/aiClient.ts';
import { Modal } from '../../components/ui/Modal.tsx';
import toast from 'react-hot-toast';

const CareerCompass: React.FC = () => {
    const supabase = useSupabase();
    const [mentorQuery, setMentorQuery] = useState('');
    const [isMentorThinking, setIsMentorThinking] = useState(false);
    const [mentorResponse, setMentorResponse] = useState<string | null>(null);

    // Tools Modals
    const [activeTool, setActiveTool] = useState<'sop' | 'uni' | 'scholarship' | null>(null);
    const [toolResult, setToolResult] = useState<string | null>(null);
    const [isToolProcessing, setIsToolProcessing] = useState(false);

    const handleMentorSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mentorQuery.trim()) return;

        setIsMentorThinking(true);
        try {
            const result = await runAI({
                task: 'agentic-chat',
                payload: {
                    message: `Act as a Career Admissions Expert. Provide a detailed, professional, and actionable response for: "${mentorQuery}"`,
                    userRole: 'Student',
                    pageContext: 'Career Compass: Post-Graduation & Global Admissions',
                    currentDate: new Date().toLocaleDateString()
                },
                supabase
            });
            setMentorResponse(result.text);
            toast.success("Mentor advice received!");
        } catch (error) {
            toast.error("Failed to reach the mentor.");
        } finally {
            setIsMentorThinking(false);
        }
    };

    const runTool = async (task: string, prompt: string) => {
        setIsToolProcessing(true);
        setActiveTool(task as any);
        try {
            const result = await runAI({
                task: 'agentic-chat',
                payload: {
                    message: prompt,
                    userRole: 'Student',
                    pageContext: `Career Toolkit: ${task}`,
                },
                supabase
            });
            setToolResult(result.text);
        } catch (error) {
            toast.error("Process failed.");
        } finally {
            setIsToolProcessing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-6 pb-20">
            <header className="mb-8 text-left">
                <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter uppercase mb-2">
                    <span className="text-primary">Career</span> <span className="text-white opacity-80">Compass</span>
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    AI-Driven Global Pathways & Post-Graduation Excellence.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AI Mentor Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card glow="primary" className="p-6 border-primary/20 bg-primary/5 min-h-[400px] flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                                <span className="material-symbols-outlined text-primary">psychology</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Admissions Mentor</h2>
                                <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Global Advisory Active</p>
                            </div>
                        </div>

                        <div className="flex-grow bg-black/40 rounded-xl border border-white/5 p-4 mb-4 overflow-y-auto max-h-[300px] custom-scrollbar">
                            {mentorResponse ? (
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <div className="text-text-base leading-relaxed whitespace-pre-wrap">{mentorResponse}</div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                    <span className="material-symbols-outlined text-4xl mb-2">explore</span>
                                    <p className="text-sm italic">Ask about GRE, GATE, Ivy League admissions, or Scholarships...</p>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleMentorSubmit} className="flex gap-2">
                            <Input
                                placeholder="Ask your career question..."
                                value={mentorQuery}
                                onChange={(e) => setMentorQuery(e.target.value)}
                                className="flex-grow bg-black/60 border-primary/30"
                            />
                            <Button variant="primary" disabled={isMentorThinking} className="px-6 h-12">
                                {isMentorThinking ? <Spinner className="w-5 h-5" /> : <span className="material-symbols-outlined">send</span>}
                            </Button>
                        </form>
                    </Card>

                    {/* Preparation Roadmap */}
                    <Card glow="none" className="bg-black/60 border-white/10 p-8">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8 text-center underline decoration-primary underline-offset-8">Preparation Roadmap</h2>
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            {[
                                { step: '01', title: 'Assessment', desc: 'Identify your target: Global Ed, Govt, or Tech' },
                                { step: '02', title: 'Prep exams', desc: 'IELTS/GRE/GATE/CAT specific coaching' },
                                { step: '03', title: 'Documents', desc: 'Drafting high-impact LORs and SOPs' },
                                { step: '04', title: 'Applying', desc: 'Early bird submissions for early admission' }
                            ].map((step, i) => (
                                <div key={i} className="flex-1 text-center group">
                                    <div className="w-12 h-12 rounded-full border-2 border-primary/20 bg-primary/5 flex items-center justify-center mx-auto mb-4 group-hover:border-primary transition-colors">
                                        <span className="text-primary font-black">{step.step}</span>
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
                                    <p className="text-[10px] text-text-muted px-4 leading-tight">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Tools & Quick Actions Column */}
                <div className="space-y-6">
                    <Card glow="secondary" className="p-6 border-secondary/20 bg-secondary/5">
                        <h2 className="text-lg font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-3">
                            <span className="material-symbols-outlined text-secondary">handyman</span>
                            Pathfinder Tools
                        </h2>
                        <div className="space-y-3">
                            <button
                                onClick={() => runTool('sop', 'Act as SOP Architect. Create a high-quality outline for a Statement of Purpose for MS in Computer Science, highlighting technical skills and undergraduate research.')}
                                className="w-full p-4 bg-black/40 rounded-xl border border-white/5 hover:border-secondary/50 transition-all flex items-center gap-4 group text-left"
                            >
                                <span className="material-symbols-outlined text-secondary group-hover:scale-110 transition-transform">history_edu</span>
                                <div>
                                    <p className="text-sm font-bold text-white">SOP Architect</p>
                                    <p className="text-[10px] text-text-muted">Draft a winning Statement of Purpose</p>
                                </div>
                            </button>

                            <button
                                onClick={() => runTool('uni', 'Act as University Matchmaker. Suggest 5 dream, 5 target, and 5 safe universities in the USA and Germany for an Indian student with a 3.5/4.0 GPA.')}
                                className="w-full p-4 bg-black/40 rounded-xl border border-white/5 hover:border-secondary/50 transition-all flex items-center gap-4 group text-left"
                            >
                                <span className="material-symbols-outlined text-secondary group-hover:scale-110 transition-transform">travel_explore</span>
                                <div>
                                    <p className="text-sm font-bold text-white">University Finder</p>
                                    <p className="text-[10px] text-text-muted">AI-matched Global Universities</p>
                                </div>
                            </button>

                            <button
                                onClick={() => runTool('scholarship', 'Identify the current active overseas and national scholarships for engineering students in Telangana, India for the 2026 academic year.')}
                                className="w-full p-4 bg-black/40 rounded-xl border border-white/5 hover:border-secondary/50 transition-all flex items-center gap-4 group text-left"
                            >
                                <span className="material-symbols-outlined text-secondary group-hover:scale-110 transition-transform">account_balance</span>
                                <div>
                                    <p className="text-sm font-bold text-white">Scholarship Hub</p>
                                    <p className="text-[10px] text-text-muted">Active Global & Govt Funding</p>
                                </div>
                            </button>
                        </div>
                    </Card>

                    <Card glow="none" className="p-8 border-primary/20 bg-primary/5 flex flex-col items-center justify-center text-center opacity-70 border-dashed">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-primary">event_note</span>
                        </div>
                        <h3 className="text-sm font-black text-white uppercase mb-2">My Milestones</h3>
                        <p className="text-[10px] text-text-muted">Personalized deadlines will appear here once you select a global target path.</p>
                    </Card>
                </div>
            </div>

            <Modal
                isOpen={!!activeTool}
                onClose={() => { setActiveTool(null); setToolResult(null); }}
                title={`${activeTool?.toUpperCase()} Assistant`}
            >
                <div className="space-y-4">
                    {isToolProcessing ? (
                        <div className="flex flex-col items-center justify-center p-12 space-y-4">
                            <Spinner className="w-10 h-10 text-secondary" />
                            <p className="text-sm text-text-muted animate-pulse">Architecting your global pathway...</p>
                        </div>
                    ) : (
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4 max-h-[500px] overflow-y-auto prose prose-invert prose-sm max-w-none">
                            <div className="text-text-base leading-relaxed whitespace-pre-wrap">{toolResult}</div>
                        </div>
                    )}
                    <Button variant="secondary" className="w-full mt-4" onClick={() => { setActiveTool(null); setToolResult(null); }}>
                        Close & Continue
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default CareerCompass;
