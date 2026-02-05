
import React, { useState, useEffect, useRef } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { Modal } from '../ui/Modal.tsx';
import { Input } from '../ui/Input.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import toast from 'react-hot-toast';

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: 'student' | 'opportunity', id: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onSelect }) => {
    const supabase = useSupabase();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ students: any[], opportunities: any[] }>({ students: [], opportunities: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-IN'; // Optimized for Indian context

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) {
                    setQuery(transcript);
                    toast.success(`Heard: "${transcript}"`, { icon: '🎙️' });
                }
                setIsListening(false);
            };

            recognitionRef.current.onerror = (e: any) => {
                console.error('Speech Error:', e);
                setIsListening(false);
                if (e.error !== 'no-speech') toast.error("Could not capture voice command");
            };

            recognitionRef.current.onend = () => setIsListening(false);
        }
    }, []);

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            try {
                recognitionRef.current?.start();
                setIsListening(true);
            } catch (e) {
                console.error('Start Error:', e);
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setQuery('');
            setResults({ students: [], opportunities: [] });
        }
    }, [isOpen]);

    useEffect(() => {
        if (query.length < 2) {
            setResults({ students: [], opportunities: [] });
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsLoading(true);
            try {
                const [studentRes, oppRes] = await Promise.all([
                    supabase.from('student_registry')
                        .select('id, name, roll_number, department')
                        .or(`name.ilike.%${query}%,roll_number.ilike.%${query}%`)
                        .limit(5),
                    supabase.from('opportunities')
                        .select('id, title, company')
                        .or(`title.ilike.%${query}%,company.ilike.%${query}%`)
                        .limit(5)
                ]);

                setResults({
                    students: studentRes.data || [],
                    opportunities: oppRes.data || []
                });
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query, supabase]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Command Center Search">
            <div className="relative">
                <Input
                    ref={inputRef}
                    placeholder="Search students, roll numbers, or companies..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={`pl-10 pr-12 text-lg py-4 border-2 border-primary/50 bg-black/40 transition-all ${isListening ? 'ring-2 ring-secondary animate-pulse shadow-[0_0_15px_rgba(var(--color-secondary-rgb),0.3)]' : ''}`}
                />
                <span className="material-symbols-outlined absolute left-3 top-4 text-primary text-2xl">search</span>
                <div className="absolute right-3 top-3.5 flex items-center gap-2">
                    {isLoading && <Spinner className="w-5 h-5 border-2 border-primary border-t-transparent" />}

                    <button
                        onClick={toggleListening}
                        title={isListening ? "Stop listening" : "Voice Command"}
                        className={`p-1.5 rounded-full transition-all duration-300 ${isListening ? 'bg-secondary text-white scale-110 shadow-lg' : 'text-text-muted hover:text-secondary hover:bg-secondary/10'}`}
                    >
                        <span className="material-symbols-outlined leading-none">{isListening ? 'graphic_eq' : 'mic'}</span>
                    </button>
                </div>
            </div>

            <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {results.students.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">groups</span> Students
                        </h3>
                        <div className="space-y-2">
                            {results.students.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => { onSelect('student', s.id); onClose(); }}
                                    className="w-full text-left p-3 rounded-lg bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-text-base group-hover:text-primary">{s.name}</span>
                                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-mono">{s.roll_number}</span>
                                    </div>
                                    <div className="text-xs text-text-muted mt-1">{s.department}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {results.opportunities.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">work</span> Opportunities
                        </h3>
                        <div className="space-y-2">
                            {results.opportunities.map((o) => (
                                <button
                                    key={o.id}
                                    onClick={() => { onSelect('opportunity', o.id); onClose(); }}
                                    className="w-full text-left p-3 rounded-lg bg-white/5 border border-white/5 hover:border-secondary/50 hover:bg-secondary/5 transition-all group"
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-text-base group-hover:text-secondary">{o.title}</span>
                                        <span className="text-xs text-text-muted">{o.company}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {query.length >= 2 && results.students.length === 0 && results.opportunities.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-text-muted italic">
                        No matches found for "{query}"
                    </div>
                )}

                {query.length < 2 && (
                    <div className="text-center py-8 text-text-muted space-y-2">
                        <p className="text-sm">Start typing to search...</p>
                        <div className="flex justify-center gap-4 text-[10px] opacity-50">
                            <span className="flex items-center gap-1"><kbd className="bg-white/10 px-1 rounded">↑↓</kbd> Navigate</span>
                            <span className="flex items-center gap-1"><kbd className="bg-white/10 px-1 rounded">Enter</kbd> Select</span>
                            <span className="flex items-center gap-1"><kbd className="bg-white/10 px-1 rounded">Esc</kbd> Close</span>
                            <span className="flex items-center gap-1 text-secondary"><span className="material-symbols-outlined text-[12px]">mic</span> Voice Search Available</span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
