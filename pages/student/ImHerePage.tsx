
import React, { useState, useEffect } from 'react';
import type { StudentProfile, ImHereRequest } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';

interface ImHerePageProps {
    user: StudentProfile;
}

export const PAGE_SIZE = 10;

// Fetch Requests
const fetchImHereRequests = async (supabase, college: string, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // Fix: Map 'urgency' column (DB) to 'deadline' property (Frontend)
    const { data, error, count } = await supabase
        .from('im_here_requests')
        .select('*, deadline:urgency', { count: 'exact' })
        .eq('college', college)
        .eq('status', 'open') // Only fetch open requests
        .order('urgency', { ascending: true }) // Earliest deadline (urgency) first
        .range(from, to);

    if (error) throw error;
    return { data: (data as ImHereRequest[]) || [], count: count || 0 };
};

// Find Matches from Campus Services
const findServiceMatches = async (supabase, keyword: string, college: string) => {
    if (!keyword || keyword.length < 3) return [];

    // Simple keyword matching against service title and category
    const { data, error } = await supabase
        .from('campus_resources')
        .select('id, item_name, service_rate, availability, lister:students!lister_id(id, name, mobile_number)')
        .eq('college', college)
        .eq('listing_type', 'service')
        .or(`item_name.ilike.%${keyword}%,category.ilike.%${keyword}%`)
        .limit(3);

    if (error) {
        console.error("Match error", error);
        return [];
    }
    return data || [];
};

const createImHereRequest = async (supabase, request: Omit<ImHereRequest, 'id' | 'created_at' | 'status'>) => {
    // Fix: Map frontend 'deadline' to backend 'urgency' column to match schema
    const { deadline, ...rest } = request;
    const dbPayload = {
        ...rest,
        urgency: deadline, // Storing ISO timestamp in 'urgency' column
        status: 'open'
    };

    const { data, error } = await supabase
        .from('im_here_requests')
        .insert(dbPayload)
        .select()
        .single();
    if (error) throw error;

    await supabase.rpc('award_xp', { user_id: request.requester_id, xp_amount: 5 });
    return data;
};

const updateImHereRequestStatus = async (supabase, { requestId, status, offererId, offererName }: { requestId: string, status: ImHereRequest['status'], offererId?: string, offererName?: string }) => {
    const updatePayload: Partial<ImHereRequest> = { status };
    if (status === 'accepted') {
        updatePayload.offerer_id = offererId;
        updatePayload.offerer_name = offererName;
        updatePayload.accepted_at = new Date().toISOString();
        await supabase.rpc('award_xp', { user_id: offererId, xp_amount: 10 });
    } else if (status === 'fulfilled') {
        updatePayload.fulfilled_at = new Date().toISOString();
        const { data: requestData } = await supabase.from('im_here_requests').select('requester_id').eq('id', requestId).single();
        if (requestData?.requester_id) {
            await supabase.rpc('award_xp', { user_id: requestData.requester_id, xp_amount: 5 });
        }
    }

    const { error } = await supabase.from('im_here_requests').update(updatePayload).eq('id', requestId);
    if (error) throw error;
};

const ImHerePage: React.FC<ImHerePageProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

    const { data: requestsData, isLoading, isError, error } = useQuery<{ data: ImHereRequest[]; count: number }, Error>({
        queryKey: ['imHereRequests', user.college, page],
        queryFn: () => fetchImHereRequests(supabase, user.college, page),
        placeholderData: (previousData) => previousData,
        refetchInterval: 10000, // Live poll every 10s
    });

    const requests = requestsData?.data ?? [];
    const count = requestsData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const createRequestMutation = useMutation({
        mutationFn: (request: Omit<ImHereRequest, 'id' | 'created_at' | 'status'>) => createImHereRequest(supabase, request),
        onSuccess: () => {
            toast.success("Your request has been posted! +5 XP");
            queryClient.invalidateQueries({ queryKey: ['imHereRequests', user.college] });
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            setIsRequestModalOpen(false);
        },
        onError: (err) => toast.error(`Failed to post request: ${err.message}`),
    });

    const updateRequestMutation = useMutation({
        mutationFn: (vars: { requestId: string, status: ImHereRequest['status'], offererId?: string, offererName?: string }) => updateImHereRequestStatus(supabase, vars),
        onSuccess: (data, variables) => {
            if (variables.status === 'accepted') toast.success(`You accepted a request! Go help out! +10 XP`);
            else if (variables.status === 'fulfilled') toast.success("Request marked as fulfilled! +5 XP for requester");
            else if (variables.status === 'cancelled') toast.success("Request cancelled.");
            queryClient.invalidateQueries({ queryKey: ['imHereRequests', user.college] });
        },
        onError: (err) => toast.error(`Failed to update request: ${err.message}`),
    });

    useEffect(() => {
        const channel = supabase.channel('im_here_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'im_here_requests' }, payload => {
                queryClient.invalidateQueries({ queryKey: ['imHereRequests', user.college] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user.college, queryClient, supabase]);


    const getStatusColor = (status: ImHereRequest['status']) => {
        switch (status) {
            case 'open': return 'bg-blue-500/50 text-blue-200';
            case 'accepted': return 'bg-yellow-500/50 text-yellow-200';
            case 'fulfilled': return 'bg-green-500/50 text-green-200';
            case 'cancelled': return 'bg-red-500/50 text-red-200';
        }
    }

    const getTimeRemaining = (deadline: string) => {
        if (!deadline) return "No deadline";
        const now = new Date();
        const due = new Date(deadline);
        const diffMs = due.getTime() - now.getTime();

        if (diffMs < 0) return "Overdue";
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHrs > 24) return `Due ${due.toLocaleDateString()}`;
        if (diffHrs > 0) return `Due in ${diffHrs}h ${diffMins}m`;
        return `Due in ${diffMins}m`;
    };

    const getDeadlineColor = (deadline: string) => {
        if (!deadline) return 'text-text-muted';
        const now = new Date();
        const due = new Date(deadline);
        const diffHrs = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHrs < 0) return 'text-gray-500'; // Overdue
        if (diffHrs < 1) return 'text-red-500 font-bold animate-pulse'; // Urgent < 1h
        if (diffHrs < 4) return 'text-yellow-400'; // Medium < 4h
        return 'text-green-400';
    }

    return (
        <div className="font-student-body">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            I'm Here Help
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            Real-time campus micro-assistance. Request help with supplies, spot-holding, or urgent campus tasks.
                        </p>
                    </div>
                    <Button variant="secondary" onClick={() => setIsRequestModalOpen(true)} className="whitespace-nowrap shadow-lg">
                        + Request Help Now
                    </Button>
                </div>
            </header>

            <Card glow="none">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : isError ? (
                    <p className="text-red-400 text-center p-8">Error loading requests: {error?.message}</p>
                ) : (
                    <>
                        <div className="space-y-4">
                            {requests.length === 0 && (
                                <p className="text-center text-lg text-text-muted">No open requests for help yet. Be the first to ask!</p>
                            )}
                            {requests.map(req => (
                                <div key={req.id} className="bg-background/50 p-4 rounded-md border border-primary/20">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                                        <div>
                                            <h2 className="font-display text-2xl text-primary">{req.item_description}</h2>
                                            <p className="text-xl text-text-base">Needed by <span className="font-bold text-secondary">{req.requester_name}</span></p>
                                            <p className="text-sm text-text-muted">At: {req.location_description} | <span className={`${getDeadlineColor(req.deadline)}`}>{getTimeRemaining(req.deadline)}</span></p>
                                            {req.offerer_name && <p className="text-sm text-green-400">Accepted by: {req.offerer_name}</p>}
                                        </div>
                                        <div className="flex gap-2 self-end sm:self-auto flex-wrap">
                                            <span className={`px-3 py-1 text-sm font-bold rounded-full capitalize ${getStatusColor(req.status)}`}>
                                                {req.status}
                                            </span>
                                            {req.requester_id === user.id && req.status === 'open' && (
                                                <Button variant="ghost" className="text-xs py-1 px-2 !border-red-400 !text-red-400 hover:!bg-red-500 hover:!text-white" onClick={() => updateRequestMutation.mutate({ requestId: req.id, status: 'cancelled' })}>Cancel</Button>
                                            )}
                                            {req.requester_id === user.id && req.status === 'accepted' && (
                                                <Button variant="secondary" className="text-xs py-1 px-2" onClick={() => updateRequestMutation.mutate({ requestId: req.id, status: 'fulfilled' })}>Mark Fulfilled</Button>
                                            )}
                                            {req.requester_id !== user.id && req.status === 'open' && (
                                                <Button variant="primary" className="text-xs py-1 px-2" onClick={() => updateRequestMutation.mutate({ requestId: req.id, status: 'accepted', offererId: user.id, offererName: user.name })}>Accept Request</Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </>
                )}
            </Card>

            <CreateRequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                user={user}
                createRequestMutation={createRequestMutation}
                findServiceMatches={findServiceMatches}
                supabase={supabase}
            />
        </div>
    );
};

interface CreateRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: StudentProfile;
    createRequestMutation: ReturnType<typeof useMutation>;
    findServiceMatches: (supabase: any, keyword: string, college: string) => Promise<any[]>;
    supabase: any;
}

const CreateRequestModal: React.FC<CreateRequestModalProps> = ({ isOpen, onClose, user, createRequestMutation, findServiceMatches, supabase }) => {
    const [itemDescription, setItemDescription] = useState('');
    const [locationDescription, setLocationDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [matches, setMatches] = useState<any[]>([]);

    useEffect(() => {
        if (!isOpen) {
            setItemDescription('');
            setLocationDescription('');
            // Default deadline: 1 hour from now
            const now = new Date();
            now.setHours(now.getHours() + 1);
            setDeadline(now.toISOString().substring(0, 16));
            setMatches([]);
        } else {
            // Reset to 1 hr from now when opening
            const now = new Date();
            now.setHours(now.getHours() + 1);
            setDeadline(now.toISOString().substring(0, 16));
        }
    }, [isOpen]);

    // Live Matching Logic
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (itemDescription.length > 2) {
                const results = await findServiceMatches(supabase, itemDescription, user.college);
                setMatches(results);
            } else {
                setMatches([]);
            }
        }, 500); // Debounce
        return () => clearTimeout(handler);
    }, [itemDescription, supabase, user.college, findServiceMatches]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemDescription.trim() || !locationDescription.trim() || !deadline) {
            toast.error('All fields are required.');
            return;
        }

        const deadlineDate = new Date(deadline);
        if (deadlineDate < new Date()) {
            toast.error("Deadline cannot be in the past.");
            return;
        }

        createRequestMutation.mutate({
            requester_id: user.id,
            requester_name: user.name,
            requester_role: user.role,
            college: user.college,
            item_description: itemDescription.trim(),
            location_description: locationDescription.trim(),
            deadline: new Date(deadline).toISOString(),
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Request Help on Campus">
            <div className="flex flex-col md:flex-row gap-6">
                <form onSubmit={handleSubmit} className="space-y-4 flex-1">
                    <p className="text-lg text-text-muted">Need something quickly? Post a request!</p>
                    <Input
                        label="What do you need?"
                        placeholder="e.g., Printing, Pen, Charger"
                        value={itemDescription}
                        onChange={e => setItemDescription(e.target.value)}
                        required
                    />
                    <Input
                        label="Where are you located?"
                        placeholder="e.g., Library 2nd Floor"
                        value={locationDescription}
                        onChange={e => setLocationDescription(e.target.value)}
                        required
                    />
                    <div>
                        <label className="block text-primary font-student-label text-lg mb-2">Required By (Time)</label>
                        <Input
                            type="datetime-local"
                            value={deadline}
                            onChange={e => setDeadline(e.target.value)}
                            required
                            className="text-white"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={createRequestMutation.isPending}>
                        {createRequestMutation.isPending ? <Spinner /> : 'Post Request'}
                    </Button>
                </form>

                {/* Recommendations Panel */}
                <div className="w-full md:w-64 border-l border-primary/20 pl-6">
                    <h3 className="font-display text-primary text-sm uppercase tracking-widest mb-4">Matched Providers</h3>
                    {matches.length === 0 ? (
                        <p className="text-xs text-text-muted italic">Type to find service providers...</p>
                    ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                            {matches.map(m => (
                                <div key={m.id} className="bg-secondary/10 p-2 rounded border border-secondary/30 animate-fade-in-up">
                                    <p className="font-bold text-sm text-secondary">{m.item_name}</p>
                                    <p className="text-xs text-text-base">by {m.lister?.name}</p>
                                    {m.availability && m.availability.days && (
                                        <p className="text-[10px] text-text-muted mt-1">
                                            🕒 {m.availability.days.slice(0, 3).join(',')}.. {m.availability.startTime}-{m.availability.endTime}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-primary mt-1">{m.lister?.mobile_number}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ImHerePage;
