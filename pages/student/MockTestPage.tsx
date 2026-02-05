

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { StudentProfile } from '../../types.ts';
import { runAI } from '../../services/aiClient.ts';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import toast from 'react-hot-toast';

interface Question {
    id: number;
    type: 'mcq' | 'sql' | 'coding';
    question: string;
    options?: string[];
    correctIndex?: number;
    hint?: string;
}

// Fix: Changed to named export to address "Module has no default export" error in consuming files.
export const MockTestPage: React.FC<{ user: StudentProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const [gameState, setGameState] = useState<'setup' | 'test' | 'terminated' | 'result'>('setup');
    const [topic, setTopic] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [userAnswers, setUserAnswers] = useState<Record<number, any>>({});
    const [currentQ, setCurrentQ] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [warnings, setWarnings] = useState(0);
    const [proctorLog, setProctorLog] = useState<string[]>([]);
    const [aiReport, setAiReport] = useState('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const proctorIntervalRef = useRef<any>(null);

    useEffect(() => {
        return () => stopExamSession();
    }, []);

    const stopExamSession = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (proctorIntervalRef.current) clearInterval(proctorIntervalRef.current);
    };

    const startTest = async () => {
        if (!topic.trim()) return toast.error("Please enter a subject topic.");
        setIsGenerating(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;

            // Fix: Added supabase client to runAI call
            const data = await runAI({ task: 'generate-mock-test', payload: { topic, count: 5 }, supabase: supabase });
            setQuestions(data);
            setGameState('test');
            setWarnings(0);
            setProctorLog([]);

            proctorIntervalRef.current = setInterval(runProctorCheck, 15000);

        } catch (e: any) {
            toast.error("Webcam & Mic access required for proctored Exam Hall.");
        } finally {
            setIsGenerating(false);
        }
    };

    const runProctorCheck = async () => {
        if (gameState !== 'test' || !videoRef.current) return;

        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];

        try {
            // Fix: Added supabase client to runAI call
            const result = await runAI({ task: 'proctor-check', payload: { base64Data }, supabase: supabase });
            if (result.isViolation) {
                setWarnings(prev => prev + 1);
                setProctorLog(prev => [`${new Date().toLocaleTimeString()}: ${result.reason}`, ...prev]);
                toast.error(`Proctor Warning: ${result.reason}`);
                if (warnings + 1 >= 3) {
                    setGameState('terminated');
                    stopExamSession();
                    toast.error("Exam terminated due to repeated violations.", { duration: 5000 });
                }
            }
        } catch (e) {
            console.error("Proctor AI error:", e);
        }
    };

    const submitAnswer = (qId: number, answer: any) => {
        setUserAnswers(prev => ({ ...prev, [qId]: answer }));
        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1);
        } else {
            generateReport();
        }
    };

    const generateReport = async () => {
        stopExamSession();
        setGameState('result');

        let score = 0;
        const feedback: string[] = [];
        questions.forEach(q => {
            const userAnswer = userAnswers[q.id];
            let isCorrect = false;

            if (q.type === 'mcq') {
                isCorrect = userAnswer === q.correctIndex;
            }
            // Add other question types handling here if needed

            if (isCorrect) {
                score++;
                feedback.push(`Question ${q.id}: Correct!`);
            } else {
                feedback.push(`Question ${q.id}: Incorrect. Hint: ${q.hint || 'No hint provided.'}`);
            }
        });

        const reportPayload = {
            topic,
            score: `${score}/${questions.length}`,
            violations: proctorLog,
            feedback: feedback.join('\n')
        };

        try {
            // Fix: Added supabase client to runAI call
            const result = await runAI({ task: 'generate-exam-report', payload: reportPayload, supabase: supabase });
            setAiReport(result.text);
        } catch (e: any) {
            handleAiInvocationError(e);
        }
    };

    const resetTest = () => {
        stopExamSession();
        setGameState('setup');
        setTopic('');
        setQuestions([]);
        setUserAnswers({});
        setCurrentQ(0);
        setWarnings(0);
        setProctorLog([]);
        setAiReport('');
    };

    return (
        <div className="pb-24 font-student-body">
            <header className="mb-8 p-4 md:p-0">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Mock Exam Hall
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    AI-Proctored assessment engine. Predictive performance analytics and anti-cheat verification.
                </p>
            </header>

            {gameState === 'setup' && (
                <Card glow="primary" className="border-primary/20">
                    <h2 className="font-display text-2xl text-white mb-4">Set Up Your Test</h2>
                    <p className="text-text-muted mb-6">
                        Enter a technical subject, and our AI will generate a mock test.
                        Your webcam and microphone are required for AI-powered proctoring.
                    </p>
                    <Input label="Subject Topic" placeholder="e.g., Data Structures, Python Basics, SQL Queries" value={topic} onChange={e => setTopic(e.target.value)} required />
                    <Button onClick={startTest} disabled={isGenerating} className="w-full mt-6 shadow-primary">
                        {isGenerating ? <Spinner /> : 'Generate & Start Test'}
                    </Button>
                </Card>
            )}

            {(gameState === 'test' || gameState === 'terminated') && questions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card glow="none" className="md:col-span-2 border-primary/20 p-0 overflow-hidden">
                        <div className="p-4 border-b border-primary/20 bg-primary/5 flex justify-between items-center">
                            <h2 className="font-display text-xl text-primary">Question {currentQ + 1} of {questions.length}</h2>
                            {gameState === 'test' && (
                                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30 animate-pulse">
                                    Proctoring Active (Warnings: {warnings})
                                </span>
                            )}
                        </div>
                        <div className="p-6">
                            {gameState === 'terminated' ? (
                                <div className="text-center py-10">
                                    <h3 className="font-display text-3xl text-red-500 mb-4">TEST TERMINATED</h3>
                                    <p className="text-text-muted">You exceeded the allowed proctoring violations. Your session has ended.</p>
                                    <Button onClick={resetTest} className="mt-8">Back to Setup</Button>
                                </div>
                            ) : (
                                <CurrentQuestion
                                    question={questions[currentQ]}
                                    userAnswer={userAnswers[questions[currentQ].id]}
                                    onSubmit={answer => submitAnswer(questions[currentQ].id, answer)}
                                    isLastQuestion={currentQ === questions.length - 1}
                                />
                            )}
                        </div>
                    </Card>

                    <Card glow="none" className="border-secondary/20 h-full flex flex-col p-0 overflow-hidden">
                        <div className="bg-secondary/5 border-b border-secondary/20 p-4">
                            <h3 className="font-display text-xl text-secondary">Proctor Feed</h3>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-4">
                            <div className="w-full h-48 bg-black rounded-lg overflow-hidden border border-white/10 relative mb-4">
                                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover"></video>
                                <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-[10px] text-white">Live Feed</div>
                            </div>
                            <div className="w-full h-32 bg-black/20 rounded-lg p-2 overflow-y-auto text-xs custom-scrollbar border border-white/10">
                                {proctorLog.length === 0 ? <p className="text-text-muted italic text-center mt-4">No proctor warnings yet.</p> : (
                                    proctorLog.map((log, i) => <p key={i} className="text-red-300 mb-1">{log}</p>)
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {gameState === 'result' && (
                <Card glow="secondary" className="border-secondary/20">
                    <h2 className="font-display text-3xl text-green-400 mb-4">Test Report Complete</h2>
                    <p className="text-text-muted mb-6">Here's your AI-generated performance report and proctoring summary.</p>
                    {aiReport ? (
                        <div className="prose prose-invert max-w-none">
                            <MarkdownRenderer content={aiReport} />
                        </div>
                    ) : (
                        <div className="flex justify-center p-8"><Spinner /><p className="ml-2 text-text-muted">Generating report...</p></div>
                    )}
                    <Button onClick={resetTest} className="w-full mt-8">Retake Test</Button>
                </Card>
            )}
        </div>
    );
};

const CurrentQuestion: React.FC<{ question: Question, userAnswer: any, onSubmit: (answer: any) => void, isLastQuestion: boolean }> = ({ question, userAnswer, onSubmit, isLastQuestion }) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(userAnswer);
    const [codeAnswer, setCodeAnswer] = useState(userAnswer || '');

    useEffect(() => {
        setSelectedOption(userAnswer);
        setCodeAnswer(userAnswer || '');
    }, [question.id, userAnswer]);

    const handleSubmit = () => {
        if (question.type === 'mcq') {
            if (selectedOption === null) { toast.error("Please select an option."); return; }
            onSubmit(selectedOption);
        } else {
            if (!codeAnswer.trim()) { toast.error("Please enter your answer."); return; }
            onSubmit(codeAnswer);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl md:text-2xl font-medium text-white mb-4">{question.question}</h3>

            {question.type === 'mcq' && (
                <div className="space-y-3">
                    {question.options?.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => setSelectedOption(index)}
                            className={`w-full text-left p-3 rounded-lg border transition-all duration-200 
                                ${selectedOption === index
                                    ? 'bg-primary/20 border-primary text-white shadow-md'
                                    : 'bg-input-bg border-white/10 text-text-muted hover:border-primary/50'
                                }`}
                        >
                            <span className="font-bold">{String.fromCharCode(65 + index)}.</span> {option}
                        </button>
                    ))}
                </div>
            )}

            {(question.type === 'sql' || question.type === 'coding') && (
                <div>
                    <label className="block text-primary font-display text-sm mb-2">{question.type === 'sql' ? 'SQL Query' : 'Code'}</label>
                    <textarea
                        className="w-full h-48 bg-input-bg border-2 border-primary/50 rounded-md p-3 text-sm font-mono text-white resize-none focus:outline-none"
                        value={codeAnswer}
                        onChange={e => setCodeAnswer(e.target.value)}
                        placeholder={question.type === 'sql' ? 'SELECT * FROM users WHERE...' : '// Write your code here...'}
                    />
                </div>
            )}

            <Button onClick={handleSubmit} className="w-full mt-6">
                {isLastQuestion ? 'Finish Test' : 'Next Question'}
            </Button>
        </div>
    );
};