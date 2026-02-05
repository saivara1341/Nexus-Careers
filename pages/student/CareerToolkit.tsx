

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useMutation } from '@tanstack/react-query';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';
import { useChatContext } from '../../contexts/ChatContext.tsx';
import { AudioVisualizer } from '../../components/ui/AudioVisualizer.tsx';
import toast from 'react-hot-toast';
// Fix: Updated import to use named export from MockTestPage.tsx.
import { MockTestPage } from './MockTestPage.tsx';

// Helper to convert File to Base64 (handles both Images and PDFs)
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = (e) => reject(e);
    });
};

// Optimized image resizer (only for images)
const resizeImage = (file: File, maxWidth = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
};

const ResumeAnalyzer: React.FC = () => {
    const supabase = useSupabase();
    const [file, setFile] = useState<File | null>(null);
    const [jobDesc, setJobDesc] = useState('');
    const { setContext } = useChatContext();

    useEffect(() => {
        setContext("User is using the AI Resume Analyzer tool.");
    }, [setContext]);

    const analysisMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error("Upload a resume.");

            const cacheKey = `resume_analysis_${file.name}_${file.size}_${jobDesc.substring(0, 20).replace(/\s/g, '')}`;
            const cachedResult = localStorage.getItem(cacheKey);
            if (cachedResult) return cachedResult;

            let base64Data = '';

            // Handle PDF vs Image
            if (file.type.includes('pdf')) {
                base64Data = await fileToBase64(file);
            } else {
                base64Data = await resizeImage(file);
            }

            const truncatedJob = jobDesc.substring(0, 1000);

            const data = await runAI({
                task: 'resume-analysis',
                payload: {
                    mimeType: file.type,
                    base64Data,
                    jobDesc: truncatedJob
                },
                supabase: supabase
            });

            try { localStorage.setItem(cacheKey, data.text); } catch (e) { console.error("Cache full", e); }
            return data.text;
        },
        onError: (e) => handleAiInvocationError(e)
    });

    return (
        <Card glow="primary" className="border-primary/20">
            <h2 className="font-display text-2xl text-primary mb-2">Resume Analyzer</h2>
            <p className="text-text-muted mb-4">
                Upload your resume (PDF or Image). <br />
                <span className="text-secondary text-xs">Option A:</span> Add a Job Description for a targeted match analysis. <br />
                <span className="text-secondary text-xs">Option B:</span> Leave empty for a general ATS & quality audit.
            </p>

            <textarea
                className="w-full bg-input-bg p-3 rounded mb-4 border border-primary/30 text-text-base h-24 focus:outline-none focus:border-primary transition-colors"
                placeholder="Paste Job Description here (Optional)..."
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="flex-grow"
                />
                <Button onClick={() => analysisMutation.mutate()} disabled={analysisMutation.isPending || !file} className="sm:w-32">
                    {analysisMutation.isPending ? <Spinner /> : 'Analyze'}
                </Button>
            </div>
            {file && <p className="text-xs text-text-muted mb-4 -mt-4">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}

            {analysisMutation.data && (
                <div className="mt-4 p-6 bg-black/40 rounded-lg border border-white/10 animate-fade-in-up">
                    <MarkdownRenderer content={analysisMutation.data} />
                </div>
            )}
        </Card>
    );
};

const ColdEmailGenerator: React.FC = () => {
    const supabase = useSupabase();
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('');
    const [recipient, setRecipient] = useState('');
    const [context, setContext] = useState('');
    const [emailContent, setEmailContent] = useState('');

    const generateMutation = useMutation({
        mutationFn: async () => {
            const data = await runAI({
                task: 'cold-email-generation',
                payload: { company, role, recipient, context },
                supabase
            });
            return data.text;
        },
        onSuccess: (text) => setEmailContent(text),
        onError: (e) => handleAiInvocationError(e)
    });

    const handleCopy = () => {
        navigator.clipboard.writeText(emailContent);
        toast.success("Copied to clipboard!");
    };

    return (
        <Card glow="secondary" className="border-secondary/20">
            <h2 className="font-display text-2xl text-secondary mb-2">Cold Email Generator</h2>
            <p className="text-text-muted mb-6">Create professional outreach emails for referrals and networking.</p>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Target Company" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google" />
                    <Input label="Target Role" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Product Manager" />
                </div>
                <Input label="Recipient Name/Title" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="e.g. John Doe, Hiring Manager" />
                <div>
                    <label className="block text-primary font-student-label text-lg mb-2">Your Context</label>
                    <textarea
                        className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 h-24"
                        placeholder="e.g. Computer Science student, built a React app, won a hackathon..."
                        value={context}
                        onChange={e => setContext(e.target.value)}
                    />
                </div>
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || !company} className="w-full">
                    {generateMutation.isPending ? <Spinner /> : 'Generate Email'}
                </Button>
            </div>

            {emailContent && (
                <div className="mt-6 p-4 bg-black/40 rounded border border-white/10 relative">
                    <button onClick={handleCopy} className="absolute top-2 right-2 text-xs text-secondary hover:underline">Copy</button>
                    <MarkdownRenderer content={emailContent} />
                </div>
            )}
        </Card>
    );
};

const SkillGapAnalyzer: React.FC = () => {
    const supabase = useSupabase();
    const [currentSkills, setCurrentSkills] = useState('');
    const [targetRole, setTargetRole] = useState('');
    const [result, setResult] = useState<any>(null);

    const analyzeMutation = useMutation({
        mutationFn: async () => {
            return await runAI({
                task: 'skill-gap-analysis',
                payload: { currentSkills, targetRole },
                supabase
            });
        },
        onSuccess: (data) => setResult(data),
        onError: (e) => handleAiInvocationError(e)
    });

    return (
        <Card glow="primary" className="border-primary/20">
            <h2 className="font-display text-2xl text-primary mb-2">Skill Gap Analyzer</h2>
            <p className="text-text-muted mb-6">Identify what you need to learn for your dream job.</p>

            <div className="space-y-4">
                <Input label="Target Role" value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Full Stack Developer at Amazon" />
                <div>
                    <label className="block text-primary font-student-label text-lg mb-2">Your Current Skills</label>
                    <textarea
                        className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 h-24"
                        placeholder="e.g. HTML, CSS, Basic JavaScript, Python..."
                        value={currentSkills}
                        onChange={e => setCurrentSkills(e.target.value)}
                    />
                </div>
                <Button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || !targetRole} className="w-full">
                    {analyzeMutation.isPending ? <Spinner /> : 'Analyze Gap'}
                </Button>
            </div>

            {result && (
                <div className="mt-6 space-y-4 animate-fade-in-up">
                    <div className="flex items-center gap-4 p-4 bg-black/40 rounded border border-white/10">
                        <div className="text-center">
                            <span className="text-xs text-text-muted uppercase">Match Score</span>
                            <p className={`text-3xl font-bold ${result.matchScore > 70 ? 'text-green-400' : 'text-yellow-400'}`}>{result.matchScore}%</p>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-red-400 mb-1">Missing Skills:</p>
                            <div className="flex flex-wrap gap-2">
                                {result.missingSkills?.map((s: string) => (
                                    <span key={s} className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded border border-red-500/30">{s}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-black/40 rounded border border-white/10">
                        <h3 className="font-display text-lg text-secondary mb-2">Learning Path</h3>
                        <MarkdownRenderer content={result.learningPath} />
                    </div>
                </div>
            )}
        </Card>
    );
};

// --- VOICE & VIDEO INTERVIEWER ---

const MockInterviewer: React.FC<{ user: any }> = ({ user }) => {
    const supabase = useSupabase();
    // Stages: setup -> interview -> generating_report -> report
    const [stage, setStage] = useState<'setup' | 'interview' | 'generating_report' | 'report'>('setup');

    // Setup State
    const [targetRole, setTargetRole] = useState('');
    const [targetCompany, setTargetCompany] = useState('');
    const [resumeOption, setResumeOption] = useState<'profile' | 'upload'>('profile');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    // Interview State
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [reportContent, setReportContent] = useState('');

    // Voice & Video Refs
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { setContext } = useChatContext();

    useEffect(() => {
        setContext("User is using the AI Video/Voice Interviewer tool.");

        // Initialize Speech Recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onstart = () => setIsListening(true);
            recognitionRef.current.onend = () => setIsListening(false);
            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                handleUserResponse(transcript);
            };
        }

        return () => {
            stopSession(); // Cleanup on unmount
        };
    }, [setContext]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            streamRef.current = stream;
            setCameraEnabled(true);
        } catch (err) {
            console.error("Camera access denied", err);
            toast.error("Camera access denied. Audio-only mode.");
            setCameraEnabled(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraEnabled(false);
    };

    const captureFrame = (): string | null => {
        if (!videoRef.current || !cameraEnabled) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.7).split(',')[1]; // Return base64
    };

    const speak = (text: string) => {
        if (!synthRef.current) return;
        // Strip markdown roughly for speech
        const cleanText = text.replace(/[*#_`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1;
        utterance.pitch = 1;

        const voices = synthRef.current.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);

        synthRef.current.speak(utterance);
    };

    const startInterview = async () => {
        if (!targetRole.trim() || !targetCompany.trim()) {
            toast.error("Please enter role and company.");
            return;
        }
        setStage('interview');
        await startCamera();

        const resumeContext = resumeOption === 'profile'
            ? "I have your resume from your profile."
            : "I have reviewed the resume you uploaded.";

        const intro = `Hello ${user.name}. I am the hiring manager for the ${targetRole} position at ${targetCompany}. ${resumeContext} Let's begin the interview. Tell me about yourself and why you're interested in this role.`;

        setMessages([{ role: 'model', text: intro }]);
        speak(intro);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
        }
    };

    const handleUserResponse = async (responseText: string) => {
        if (!responseText.trim()) return;

        const userMsg = { role: 'user' as const, text: responseText };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        const videoFrame = captureFrame(); // Capture snapshot of user answering

        try {
            const history = messages.slice(-10).map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const systemInstruction = `You are a professional interviewer for a ${targetRole} role at ${targetCompany}. 
                You are interviewing ${user.name}. 
                The user is answering via voice and video. 
                
                ANALYSIS INSTRUCTIONS:
                1. Acknowledge their answer briefly.
                2. If a video frame is provided, briefly comment on their visual confidence (eye contact, posture) in 1 short sentence. If no video, skip this.
                3. Ask the next relevant technical or behavioral question based on their response.
                
                Keep total response concise (under 60 words). Be encouraging but critical.`;

            const response = await runAI({
                task: 'chat',
                payload: {
                    message: userMsg.text,
                    history: history,
                    systemInstruction: systemInstruction,
                    image: videoFrame // Send the frame
                },
                supabase: supabase,
            });

            const aiText = response.text;
            const modelMsg = { role: 'model' as const, text: aiText };
            setMessages(prev => [...prev, modelMsg]);
            speak(aiText);

        } catch (error: any) {
            handleAiInvocationError(error);
        } finally {
            setIsThinking(false);
        }
    };

    const endAndGenerateReport = async () => {
        stopSession();
        setStage('generating_report');

        try {
            const reportData = await runAI({
                task: 'generate-interview-report',
                payload: {
                    history: messages,
                    role: targetRole,
                    company: targetCompany
                },
                supabase
            });
            setReportContent(reportData.text);
            setStage('report');
        } catch (e: any) {
            handleAiInvocationError(e);
            setStage('setup');
        }
    };

    const stopSession = () => {
        synthRef.current.cancel();
        recognitionRef.current?.stop();
        stopCamera();
    };

    return (
        <Card glow="secondary" className="min-h-[750px] flex flex-col border-secondary/20">
            <div className="flex justify-between items-center mb-4 border-b border-secondary/20 pb-2">
                <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl text-secondary">AI Mock Interviewer</h2>
                    {stage === 'interview' && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 animate-pulse">● Live</span>}
                </div>
                {stage === 'interview' && (
                    <Button variant="ghost" className="text-xs text-red-400 border-red-400" onClick={endAndGenerateReport}>End & Generate Report</Button>
                )}
                {stage === 'report' && (
                    <Button variant="ghost" onClick={() => setStage('setup')}>Start New</Button>
                )}
            </div>

            {/* SETUP STAGE */}
            {stage === 'setup' && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in-up p-8">
                    <div className="text-center space-y-2 mb-4">
                        <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-secondary/30 relative">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </div>
                        <h3 className="text-xl text-white font-bold">Interview Setup</h3>
                        <p className="text-text-muted text-sm">Configure your mock interview session.</p>
                    </div>

                    <div className="w-full max-w-md space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/30 p-2 rounded border border-white/10 text-center">
                                <span className="text-xs text-text-muted block">Name</span>
                                <span className="text-sm font-bold text-white">{user.name}</span>
                            </div>
                            <div className="bg-black/30 p-2 rounded border border-white/10 text-center">
                                <span className="text-xs text-text-muted block">Roll No</span>
                                <span className="text-sm font-bold text-white">{user.roll_number}</span>
                            </div>
                        </div>

                        <Input label="Target Role" placeholder="e.g. SDE-1, Product Manager" value={targetRole} onChange={e => setTargetRole(e.target.value)} />
                        <Input label="Target Company" placeholder="e.g. Google, Amazon" value={targetCompany} onChange={e => setTargetCompany(e.target.value)} />

                        <div>
                            <label className="block text-primary font-student-label text-sm mb-2">Resume Context</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-2 rounded border border-white/10 hover:border-secondary flex-1">
                                    <input type="radio" name="resume" checked={resumeOption === 'profile'} onChange={() => setResumeOption('profile')} />
                                    <span className="text-sm">Use Profile Resume</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer bg-black/20 p-2 rounded border border-white/10 hover:border-secondary flex-1">
                                    <input type="radio" name="resume" checked={resumeOption === 'upload'} onChange={() => setResumeOption('upload')} />
                                    <span className="text-sm">Upload New</span>
                                </label>
                            </div>
                            {resumeOption === 'upload' && (
                                <Input type="file" className="mt-2 text-xs" onChange={e => setUploadedFile(e.target.files?.[0] || null)} />
                            )}
                        </div>

                        <Button onClick={startInterview} className="w-full shadow-secondary mt-4">Start Interview</Button>
                    </div>
                </div>
            )}

            {/* INTERVIEW STAGE */}
            {stage === 'interview' && (
                <>
                    <div className="flex gap-4 mb-4 h-48 md:h-64">
                        {/* Camera Preview */}
                        <div className="flex-1 bg-black rounded-lg border border-white/10 overflow-hidden relative">
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className={`w-full h-full object-cover ${cameraEnabled ? 'block' : 'hidden'}`}
                            />
                            {!cameraEnabled && (
                                <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs">
                                    Camera Off
                                </div>
                            )}
                            <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-[10px] text-white">You</div>
                        </div>

                        {/* AI Avatar / Status */}
                        <div className="flex-1 bg-black/40 rounded-lg border border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mb-2 animate-pulse">
                                <span className="text-2xl">🤖</span>
                            </div>
                            <p className="text-xs text-secondary font-bold uppercase tracking-widest">{isSpeaking ? 'AI Speaking...' : isListening ? 'Listening to you...' : isThinking ? 'Thinking...' : 'Waiting'}</p>
                            <div className="absolute bottom-0 left-0 right-0 h-16 w-full opacity-30">
                                <AudioVisualizer isActive={isSpeaking} mode="speaking" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 p-4 custom-scrollbar bg-black/20 rounded-lg mb-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-secondary/20 text-white border border-secondary/30 rounded-br-none' : 'bg-card-bg border border-white/10 rounded-bl-none'}`}>
                                    <MarkdownRenderer content={msg.text} />
                                </div>
                            </div>
                        ))}
                        {isThinking && <div className="flex justify-start"><span className="text-text-muted text-sm italic animate-pulse">AI is analyzing answer & video frame...</span></div>}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="space-y-4">
                        <AudioVisualizer
                            isActive={isListening || isSpeaking}
                            mode={isThinking ? 'thinking' : isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle'}
                        />

                        <div className="flex gap-2 items-center">
                            <Button
                                onClick={toggleListening}
                                className={`flex-1 py-4 text-lg font-bold transition-all ${isListening ? 'bg-red-500/80 hover:bg-red-600 animate-pulse' : 'bg-secondary hover:bg-secondary/80'}`}
                                disabled={isThinking || isSpeaking}
                            >
                                {isListening ? 'Listening... (Tap to Stop)' : isThinking ? 'Processing...' : isSpeaking ? 'AI Speaking...' : 'Tap to Answer'}
                            </Button>
                        </div>
                    </div>
                </>
            )}

            {/* GENERATING REPORT */}
            {stage === 'generating_report' && (
                <div className="flex flex-col items-center justify-center h-full">
                    <Spinner className="w-12 h-12 mb-4" />
                    <p className="text-secondary animate-pulse text-lg">AI is analyzing your interview performance...</p>
                </div>
            )}

            {/* REPORT STAGE */}
            {stage === 'report' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/20 rounded-lg border border-white/10">
                    <div className="flex justify-between items-end mb-6 border-b border-white/10 pb-4">
                        <div>
                            <h3 className="text-2xl font-display text-white">Interview Report</h3>
                            <p className="text-text-muted text-sm">{targetRole} at {targetCompany}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-text-muted uppercase">Date</p>
                            <p className="text-sm font-bold text-white">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <MarkdownRenderer content={reportContent} />

                    <div className="mt-8 flex justify-center">
                        <Button onClick={() => setStage('setup')} className="w-full max-w-sm">Back to Tools</Button>
                    </div>
                </div>
            )}
        </Card>
    );
};

type ToolTab = 'resume' | 'email' | 'skills' | 'interview' | 'exam';

export default function CareerToolkit({ user }: { user: any }) {
    const [active, setActive] = useState<ToolTab>('resume');

    return (
        <div>
            <header className="mb-8 text-left">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Career Toolkit
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    AI-Powered suite for resume analysis, interview simulation, and skill optimization.
                </p>
            </header>
            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-1">
                {[
                    { id: 'resume', label: 'Resume Analyzer' },
                    { id: 'email', label: 'Cold Email Gen' },
                    { id: 'skills', label: 'Skill Gap AI' },
                    { id: 'interview', label: 'AI Mock Interview' },
                    { id: 'exam', label: 'Exam Hall' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActive(tab.id as ToolTab)}
                        className={`px-4 py-2 rounded-t-md transition-colors ${active === tab.id ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="animate-fade-in-up">
                {active === 'resume' && <ResumeAnalyzer />}
                {active === 'email' && <ColdEmailGenerator />}
                {active === 'skills' && <SkillGapAnalyzer />}
                {active === 'interview' && <MockInterviewer user={user} />}
                {active === 'exam' && <MockTestPage user={user} />}
            </div>
        </div>
    );
}