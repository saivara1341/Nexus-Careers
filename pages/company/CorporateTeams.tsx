
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { CompanyProfile, CorporateUpdate } from '../../types.ts';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Using 'department_announcements' table re-purposed for company updates.
const fetchTeamUpdates = async (supabase: any, companyId: string) => {
    const { data, error } = await supabase
        .from('department_announcements')
        .select('*')
        .eq('college_name', companyId) // Overloading college_name as company_id
        .eq('department_id', 'corporate_team')
        .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Parse content for virtual type field (Prefix logic)
    return (data || []).map((u: any) => {
        let type: CorporateUpdate['type'] = 'update';
        let content = u.content;
        
        if (content.startsWith('[REQ]')) { type = 'requirement'; content = content.substring(5).trim(); }
        else if (content.startsWith('[BLOCK]')) { type = 'blocker'; content = content.substring(7).trim(); }
        
        return { ...u, type, content };
    }) as CorporateUpdate[];
};

const postTeamUpdate = async (supabase: any, update: { companyId: string, posterId: string, posterName: string, content: string, type: string }) => {
    let finalContent = update.content;
    if (update.type === 'requirement') finalContent = `[REQ] ${finalContent}`;
    if (update.type === 'blocker') finalContent = `[BLOCK] ${finalContent}`;

    const { error } = await supabase.from('department_announcements').insert({
        college_name: update.companyId,
        department_id: 'corporate_team',
        poster_id: update.posterId,
        poster_name: update.posterName,
        content: finalContent
    });
    if (error) throw error;
};

const CorporateTeams: React.FC<{ user: CompanyProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'update' | 'requirement' | 'blocker'>('update');
    const scrollRef = useRef<HTMLDivElement>(null);

    const { data: updates = [], isLoading } = useQuery({
        queryKey: ['corporateUpdates', user.id],
        queryFn: () => fetchTeamUpdates(supabase, user.id),
        refetchInterval: 5000
    });

    const postMutation = useMutation({
        mutationFn: () => postTeamUpdate(supabase, { 
            companyId: user.id, 
            posterId: user.id, 
            posterName: user.name, 
            content: message,
            type: messageType
        }),
        onSuccess: () => {
            setMessage('');
            setMessageType('update');
            queryClient.invalidateQueries({ queryKey: ['corporateUpdates', user.id] });
        },
        onError: (e: any) => toast.error(e.message)
    });

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [updates]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if(!message.trim()) return;
        postMutation.mutate();
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4 md:mb-6">
                <h1 className="font-display text-2xl md:text-3xl text-primary">Recruitment Teams</h1>
                <p className="text-text-muted text-sm">Collaborate with your hiring team and log updates.</p>
            </div>

            <Card glow="primary" className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20 rounded-t-lg">
                    {isLoading && <div className="flex justify-center"><Spinner /></div>}
                    {!isLoading && updates.length === 0 && (
                        <div className="text-center text-text-muted py-10 text-sm">
                            <p>No updates yet. Start the conversation!</p>
                        </div>
                    )}
                    {updates.map((update) => (
                        <div key={update.id} className={`flex flex-col ${update.poster_id === user.id ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-lg border relative ${
                                update.type === 'requirement' ? 'bg-yellow-500/10 border-yellow-500/50' :
                                update.type === 'blocker' ? 'bg-red-500/10 border-red-500/50' :
                                update.poster_id === user.id ? 'bg-primary/20 border-primary text-white' : 'bg-card-bg border-white/10'
                            }`}>
                                <div className="flex justify-between items-center gap-4 mb-1">
                                    <p className="text-[10px] font-bold opacity-70">{update.poster_name}</p>
                                    <p className="text-[9px] opacity-50">{new Date(update.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                </div>
                                
                                {update.type === 'requirement' && <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 rounded uppercase font-bold tracking-wider mb-1 inline-block">Requirement</span>}
                                {update.type === 'blocker' && <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 rounded uppercase font-bold tracking-wider mb-1 inline-block">Blocker</span>}
                                
                                <p className="whitespace-pre-wrap text-sm">{update.content}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>

                <div className="p-2 bg-card-bg border-t border-white/10">
                    <div className="flex gap-2 mb-2 px-2 overflow-x-auto">
                        <button 
                            type="button" 
                            onClick={() => setMessageType('update')}
                            className={`text-[10px] md:text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${messageType === 'update' ? 'bg-primary text-black border-primary' : 'border-white/20 text-text-muted hover:border-white/50'}`}
                        >
                            General Update
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setMessageType('requirement')}
                            className={`text-[10px] md:text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${messageType === 'requirement' ? 'bg-yellow-500 text-black border-yellow-500' : 'border-white/20 text-text-muted hover:border-white/50'}`}
                        >
                            Log Requirement
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setMessageType('blocker')}
                            className={`text-[10px] md:text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${messageType === 'blocker' ? 'bg-red-500 text-black border-red-500' : 'border-white/20 text-text-muted hover:border-white/50'}`}
                        >
                            Log Blocker
                        </button>
                    </div>
                    <form onSubmit={handleSend} className="flex gap-2">
                        <Input 
                            placeholder={messageType === 'requirement' ? "What do you need?" : messageType === 'blocker' ? "What is blocking progress?" : "Share update..."} 
                            value={message} 
                            onChange={e => setMessage(e.target.value)} 
                            disabled={postMutation.isPending}
                            className={`text-sm py-2 ${messageType === 'requirement' ? 'border-yellow-500/50 focus:ring-yellow-500' : messageType === 'blocker' ? 'border-red-500/50 focus:ring-red-500' : ''}`}
                        />
                        <Button type="submit" disabled={postMutation.isPending} variant={messageType === 'update' ? 'primary' : 'secondary'} className={`text-sm py-2 px-4 ${messageType === 'blocker' ? '!bg-red-500 hover:!bg-red-600 !border-red-500' : ''}`}>
                            {postMutation.isPending ? <Spinner /> : 'Send'}
                        </Button>
                    </form>
                </div>
            </Card>
        </div>
    );
};

export default CorporateTeams;
