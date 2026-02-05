
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { StudentProfile, Opportunity } from '../../types.ts';
import { runAI } from '../../services/aiClient.ts';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import toast from 'react-hot-toast';

interface CalendarEvent {
    id: string;
    title: string;
    date: Date;
    type: 'deadline' | 'interview' | 'study' | 'event';
    description?: string;
}

interface CalendarPageProps {
    user: StudentProfile;
}

const fetchCalendarEvents = async (supabase: any, user: StudentProfile): Promise<CalendarEvent[]> => {
    const today = new Date().toISOString();

    // 1. Fetch Deadlines
    const { data: opps } = await supabase
        .from('opportunities')
        .select('id, title, company, deadline')
        .eq('college', user.college)
        .eq('status', 'active')
        .gte('deadline', today);

    // 2. Fetch Interviews (simulated logic based on pipeline)
    const { data: apps } = await supabase
        .from('applications')
        .select('opportunity:opportunities(title, company), status, current_stage, updated_at')
        .eq('student_id', user.id)
        .in('current_stage', ['Interview', 'Technical Interview', 'HR Interview']);

    const events: CalendarEvent[] = [];

    opps?.forEach((o: any) => {
        events.push({
            id: o.id,
            title: `Deadline: ${o.title}`,
            date: new Date(o.deadline),
            type: 'deadline',
            description: o.company
        });
    });

    // Simulate interview dates (2 days after last update for demo)
    apps?.forEach((a: any, i: number) => {
        const interviewDate = new Date(a.updated_at);
        interviewDate.setDate(interviewDate.getDate() + 2 + i); // Stagger them
        events.push({
            id: `int-${i}`,
            title: `Interview: ${a.opportunity.company}`,
            date: interviewDate,
            type: 'interview',
            description: a.current_stage
        });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
};

const CalendarPage: React.FC<CalendarPageProps> = ({ user }) => {
    const supabase = useSupabase();
    const [suggestedBlocks, setSuggestedBlocks] = useState<CalendarEvent[]>([]);

    const { data: events = [], isLoading } = useQuery({
        queryKey: ['calendar', user.id],
        queryFn: () => fetchCalendarEvents(supabase, user)
    });

    const optimizeMutation = useMutation({
        mutationFn: async () => {
            const deadlines = events.filter(e => e.type === 'deadline').slice(0, 5).map(e => ({ title: e.title, date: e.date.toISOString() }));
            const fixed = events.map(e => ({ title: e.title, start: e.date.toISOString() }));

            const suggestions = await runAI({
                task: 'optimize-schedule',
                payload: { deadlines, currentEvents: fixed },
                supabase
            });
            return suggestions;
        },
        onSuccess: (data) => {
            const newEvents = data.map((s: any, i: number) => ({
                id: `ai-${i}`,
                title: s.title,
                date: new Date(s.start),
                type: 'study',
                description: s.reason
            }));
            setSuggestedBlocks(newEvents);
            toast.success("Study plan generated!");
        },
        onError: (e) => handleAiInvocationError(e)
    });

    const allEvents = [...events, ...suggestedBlocks].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Simple List View for MVP
    return (
        <div className="min-h-screen pb-20 font-student-body">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Master Timeline
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            Aggregated deadlines, interview schedules, and AI-optimized study plan.
                        </p>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => optimizeMutation.mutate()}
                        disabled={optimizeMutation.isPending || isLoading}
                        className="shadow-[0_0_15px_rgba(255,165,0,0.4)] animate-pulse whitespace-nowrap"
                    >
                        {optimizeMutation.isPending ? <Spinner /> : '✨ AI Schedule Optimizer'}
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    {isLoading ? <div className="flex justify-center p-12"><Spinner /></div> : (
                        allEvents.length === 0 ? <p className="text-text-muted text-center py-10">No upcoming events found.</p> :
                            allEvents.map((event) => (
                                <Card
                                    key={event.id}
                                    glow={event.type === 'deadline' ? 'primary' : event.type === 'interview' ? 'secondary' : 'none'}
                                    className={`flex items-center gap-4 border-l-4 ${event.type === 'deadline' ? 'border-l-red-500' :
                                        event.type === 'interview' ? 'border-l-green-500' :
                                            'border-l-blue-400'
                                        }`}
                                >
                                    <div className="bg-white/10 p-3 rounded text-center min-w-[70px]">
                                        <span className="block text-xs uppercase text-text-muted">{event.date.toLocaleString('default', { month: 'short' })}</span>
                                        <span className="block text-2xl font-bold text-white">{event.date.getDate()}</span>
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="text-xl font-display text-white">{event.title}</h3>
                                        <p className="text-sm text-text-muted">{event.description}</p>
                                        <p className="text-xs text-primary mt-1">{event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    {event.type === 'study' && <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">AI Suggestion</span>}
                                </Card>
                            ))
                    )}
                </div>

                <div className="space-y-6">
                    <Card glow="none" className="bg-gradient-to-b from-card-bg to-primary/5 border-primary/20">
                        <h3 className="font-display text-lg text-primary mb-4">Quick Stats</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Deadlines (7 days)</span>
                                <span className="font-bold text-white">{events.filter(e => e.type === 'deadline').length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-text-muted">Interviews</span>
                                <span className="font-bold text-secondary">{events.filter(e => e.type === 'interview').length}</span>
                            </div>
                        </div>
                    </Card>

                    <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-sm text-yellow-200">
                        <strong>Tip:</strong> The AI Optimizer looks for gaps between your deadlines and suggests deep work blocks. Use them to prepare!
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarPage;
