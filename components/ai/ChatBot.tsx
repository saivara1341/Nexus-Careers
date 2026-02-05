
import React, { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import type { Session } from '@supabase/supabase-js';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useChatContext } from '../../contexts/ChatContext.tsx';
import { AudioVisualizer } from '../ui/AudioVisualizer.tsx';
import toast from 'react-hot-toast';

interface Message {
    role: 'user' | 'model';
    text: string;
}

type AvatarType = 
    | 'nexus' | 'nova' | 'atlas' | 'titan' | 'stark' | 'luna' 
    | 'vector' | 'cyber' | 'pulse' | 'aura' | 'zenith' | 'orbit';

const AVATARS: Record<AvatarType, { icon: string, name: string, color: string, animation: string }> = {
    nexus: { icon: '✨', name: 'Nexus Core', color: 'cyan', animation: 'animate-star-wake' },
    nova: { icon: '🌟', name: 'Nova Star', color: 'yellow', animation: 'animate-fire-wake' },
    atlas: { icon: '🌍', name: 'Atlas Prime', color: 'blue', animation: 'animate-ring-wake' },
    titan: { icon: '⚡', name: 'Titan Node', color: 'orange', animation: 'animate-bolt-wake' },
    stark: { icon: '🤖', name: 'Stark Bot', color: 'slate', animation: 'animate-diamond-wake' },
    luna: { icon: '🌙', name: 'Luna Link', color: 'indigo', animation: 'animate-crystal-wake' },
    vector: { icon: '📐', name: 'Vector AI', color: 'red', animation: 'animate-rocket-wake' },
    cyber: { icon: '🔌', name: 'Cyber Link', color: 'green', animation: 'animate-cube-wake' },
    pulse: { icon: '💓', name: 'Pulse Echo', color: 'pink', animation: 'animate-fire-wake' },
    aura: { icon: '🌈', name: 'Aura Flow', color: 'purple', animation: 'animate-star-wake' },
    zenith: { icon: '🏔️', name: 'Zenith Peak', color: 'teal', animation: 'animate-ring-wake' },
    orbit: { icon: '🛰️', name: 'Orbit Scan', color: 'blue', animation: 'animate-rocket-wake' }
};

interface ChatBotProps {
    session: Session | null;
}

const ChatBot: React.FC<ChatBotProps> = ({ session }) => {
    const supabase = useSupabase();
    const { context: pageContext } = useChatContext();
    const [isOpen, setIsOpen] = useState(false);
    const [isWaking, setIsWaking] = useState(false);
    const [showAvatarSettings, setShowAvatarSettings] = useState(false);
    const [isVoiceOnlyMode, setIsVoiceOnlyMode] = useState(false);
    const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => localStorage.getItem('nexus_voice_output') !== 'false');
    
    const [avatar, setAvatar] = useState<AvatarType>(() => {
        const saved = localStorage.getItem('nexus_avatar') as AvatarType;
        return (saved && AVATARS[saved]) ? saved : 'nexus';
    });
    
    const [pos, setPos] = useState(() => {
        const saved = localStorage.getItem('nexus_chat_pos');
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 100, y: window.innerHeight - 150 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragStartTime = useRef(0);

    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: "Nexus Intelligence initialized. How can I assist you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.lang = 'en-US';
            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                processInput(transcript);
            };
            recognitionRef.current.onstart = () => setIsListening(true);
            recognitionRef.current.onend = () => setIsListening(false);
        }

        return () => {
            if (synthRef.current) synthRef.current.cancel();
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            if (synthRef.current) synthRef.current.cancel();
            if (recognitionRef.current) recognitionRef.current.stop();
            setShowAvatarSettings(false);
            setIsVoiceOnlyMode(false);
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const speak = (text: string) => {
        if (!synthRef.current) return;
        synthRef.current.cancel();
        const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`]/g, ''));
        utterance.rate = 1;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        synthRef.current.speak(utterance);
    };

    const toggleMic = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setIsListening(true);
            recognitionRef.current?.start();
        }
    };

    const handleWakeUp = () => {
        if (isDragging) return;
        
        setIsWaking(true);
        setTimeout(() => {
            setIsOpen(true);
            setIsWaking(false);
        }, 700);
    };

    const changeAvatar = (type: AvatarType) => {
        setAvatar(type);
        localStorage.setItem('nexus_avatar', type);
        setShowAvatarSettings(false);
        toast(`Persona shifted to ${AVATARS[type].name}`, { icon: AVATARS[type].icon });
    };

    const toggleVoiceOutput = () => {
        const newVal = !isVoiceEnabled;
        setIsVoiceEnabled(newVal);
        localStorage.setItem('nexus_voice_output', String(newVal));
        toast(`Auto-Speak: ${newVal ? 'ON' : 'OFF'}`);
    };

    const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (isOpen) return;
        setIsDragging(false);
        dragStartTime.current = Date.now();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartPos.current = { x: clientX - pos.x, y: clientY - pos.y };

        const moveHandler = (moveEvent: MouseEvent | TouchEvent) => {
            setIsDragging(true);
            const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
            const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : (moveEvent as MouseEvent).clientY;
            
            const newX = Math.min(Math.max(20, moveX - dragStartPos.current.x), window.innerWidth - 80);
            const newY = Math.min(Math.max(20, moveY - dragStartPos.current.y), window.innerHeight - 80);
            
            setPos({ x: newX, y: newY });
        };

        const upHandler = () => {
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
            window.removeEventListener('touchmove', moveHandler);
            window.removeEventListener('touchend', upHandler);
            if (isDragging) localStorage.setItem('nexus_chat_pos', JSON.stringify(pos));
        };

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', upHandler);
    };

    const processInput = async (text: string) => {
        if (!text.trim() || isThinking || !session) return;

        setIsThinking(true);
        if (!isVoiceOnlyMode) setMessages(prev => [...prev, { role: 'user', text }]);
        setInput('');

        const userRole = session.user.user_metadata?.role || 'user';
        const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        try {
            const response = await runAI({
                task: 'agentic-chat',
                payload: { 
                    message: text, 
                    userRole,
                    pageContext,
                    currentDate 
                },
                supabase,
            });
            
            const aiText = response.text || "I apologize, I'm having trouble processing that request.";
            
            if (isOpen) {
                if (!isVoiceOnlyMode) setMessages(prev => [...prev, { role: 'model', text: aiText }]);
                if (isVoiceEnabled || isVoiceOnlyMode) speak(aiText);

                if (response.command) {
                    window.dispatchEvent(new CustomEvent('NEXUS_AGENT_COMMAND', { detail: response.command }));
                }
            }
        } catch (error: any) {
            handleAiInvocationError(error);
        } finally {
            setIsThinking(false);
        }
    };

    if (!isOpen) {
        return (
            <div 
                className="fixed z-50 touch-none"
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            >
                <button
                    onMouseDown={onMouseDown}
                    onTouchStart={onMouseDown}
                    onClick={handleWakeUp}
                    className="relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.3)] group overflow-hidden"
                    title="Drag to Move, Tap to Wake"
                >
                    <div className={`absolute inset-0 bg-gradient-to-br from-primary/40 via-black to-secondary/30 backdrop-blur-md rounded-full border-2 border-white/10 ${isDragging ? 'border-primary' : ''}`}></div>
                    <div className="absolute inset-[10%] bg-primary/20 rounded-full blur-xl group-hover:bg-primary/40 transition-colors"></div>
                    <div className={`relative z-10 text-3xl md:text-4xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-all ${isWaking ? AVATARS[avatar].animation : 'scale-100'}`}>
                        {AVATARS[avatar].icon}
                    </div>
                </button>
            </div>
        );
    }

    return (
        <div className={`fixed z-50 transition-all duration-500 overflow-hidden ${isVoiceOnlyMode ? 'inset-0 bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center' : 'bottom-6 right-4 left-4 md:left-auto md:right-6 md:w-96 h-[75vh] bg-background border-2 border-primary/50 shadow-[0_0_50px_rgba(var(--color-primary-rgb),0.3)] rounded-xl flex flex-col animate-fade-in-up'}`}>
            
            <div className={`flex justify-between items-center p-4 border-b border-primary/30 bg-primary/10 relative w-full ${isVoiceOnlyMode ? 'absolute top-0 left-0 right-0 border-none' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-black/40 border border-primary/30 flex items-center justify-center text-2xl shadow-inner">
                        {AVATARS[avatar].icon}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${isSpeaking ? 'bg-secondary animate-ping' : 'bg-green-500 animate-pulse'}`}></div>
                    </div>
                    <div className="flex flex-col">
                        <h3 className="font-display text-sm font-extrabold animated-gradient-text uppercase tracking-tight leading-none">
                            Nexus AI Mentor
                        </h3>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsVoiceOnlyMode(!isVoiceOnlyMode)}
                        className={`p-1.5 rounded-full transition-colors ${isVoiceOnlyMode ? 'bg-secondary text-black' : 'text-text-muted hover:text-secondary'}`}
                        title="Toggle Voice-Only Mode"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                    </button>
                    <button 
                        onClick={() => setShowAvatarSettings(!showAvatarSettings)}
                        className={`p-1.5 rounded-full transition-colors ${showAvatarSettings ? 'bg-primary text-black' : 'text-text-muted hover:text-white'}`}
                        title="AI Settings"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-white p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {showAvatarSettings && (
                    <div className="absolute top-16 right-4 w-72 bg-card-bg border border-primary/30 rounded-lg shadow-2xl p-3 z-[60] animate-fade-in-up backdrop-blur-xl max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                            <span className="text-[10px] text-text-muted uppercase font-bold">Preferences</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] text-text-muted">Speak Response</span>
                                <button onClick={toggleVoiceOutput} className={`w-8 h-4 rounded-full relative transition-colors ${isVoiceEnabled ? 'bg-primary' : 'bg-gray-700'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isVoiceEnabled ? 'right-0.5' : 'left-0.5'}`}></div>
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {(Object.keys(AVATARS) as AvatarType[]).map(type => (
                                <button key={type} onClick={() => changeAvatar(type)} className={`flex flex-col items-center p-2 rounded border transition-all ${avatar === type ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(0,255,255,0.2)]' : 'bg-black/20 border-white/10 hover:border-white/20'}`}>
                                    <span className="text-2xl">{AVATARS[type].icon}</span>
                                    <span className="text-[8px] text-white mt-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{AVATARS[type].name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isVoiceOnlyMode ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12 w-full max-w-lg text-center">
                    <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-black to-secondary/20 rounded-full blur-2xl animate-pulse"></div>
                        <div className="relative z-10 text-8xl md:text-9xl">{AVATARS[avatar].icon}</div>
                        <div className="absolute inset-0 -z-10 opacity-40">
                             <AudioVisualizer isActive={isSpeaking || isListening} mode={isThinking ? 'thinking' : isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle'} />
                        </div>
                    </div>
                    <p className="text-2xl font-display text-primary animate-pulse tracking-tight">{isThinking ? 'Thinking...' : isSpeaking ? 'AI Speaking...' : isListening ? 'Listening...' : 'Ready'}</p>
                    <button onClick={toggleMic} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isListening ? 'bg-red-500 animate-pulse scale-110' : 'bg-primary text-black hover:scale-105'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-black/20">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-primary/20 text-white border border-primary/30' : 'bg-card-bg text-text-base border border-white/10'}`}>
                                   <MarkdownRenderer content={msg.text} />
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-card-bg rounded-lg px-4 py-2 border border-white/10"><Spinner className="w-5 h-5" /></div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-3 border-t border-primary/30 bg-card-bg">
                        <div className="flex gap-2 items-center">
                            <button onClick={toggleMic} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500 animate-pulse shadow-[0_0_10px_red]' : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            </button>
                            <form onSubmit={(e) => { e.preventDefault(); processInput(input); }} className="flex-1 flex gap-2">
                                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={isListening ? "Listening..." : "Type or speak command..."} className="flex-1 bg-input-bg border-2 border-primary/30 rounded-md p-2 text-sm text-text-base focus:outline-none focus:ring-1 focus:ring-primary" disabled={isThinking || isListening} />
                                <button type="submit" className="bg-primary text-black rounded-md px-3 font-bold" disabled={isThinking || isListening || !input.trim()}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            )}
            <style>{`
                @keyframes star-wake { 0% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.5) rotate(180deg); } 100% { transform: scale(1) rotate(360deg); } }
                @keyframes rocket-wake { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-15px) rotate(-5deg); } 60% { transform: translateY(-15px) rotate(5deg); } }
                @keyframes diamond-wake { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
                @keyframes crystal-wake { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
                @keyframes bolt-wake { 0% { transform: scale(1); } 20% { transform: scale(1.2) skewX(10deg); } 40% { transform: scale(1.1) skewX(-10deg); } 100% { transform: scale(1); } }
                @keyframes fire-wake { 0%, 100% { transform: scale(1); filter: contrast(1); } 50% { transform: scale(1.2) contrast(1.5); } }
                @keyframes ring-wake { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.2); } 100% { transform: rotate(360deg) scale(1); } }
                @keyframes cube-wake { 0% { transform: rotateX(0) rotateY(0); } 50% { transform: rotateX(180deg) rotateY(180deg); } 100% { transform: rotateX(360deg) rotateY(360deg); } }
                .animate-star-wake { animation: star-wake 0.7s ease-in-out; }
                .animate-rocket-wake { animation: rocket-wake 0.7s ease-in-out; }
                .animate-diamond-wake { animation: diamond-wake 0.7s linear; }
                .animate-crystal-wake { animation: crystal-wake 0.7s ease-out; }
                .animate-bolt-wake { animation: bolt-wake 0.4s steps(2); }
                .animate-fire-wake { animation: fire-wake 0.7s infinite alternate; }
                .animate-ring-wake { animation: ring-wake 0.7s ease-in-out; }
                .animate-cube-wake { animation: cube-wake 0.7s ease-in-out; }
            `}</style>
        </div>
    );
};

export default ChatBot;
