import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { AdminProfile, StudentQuery } from '../../types.ts';
import toast from 'react-hot-toast';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';

const PAGE_SIZE = 20;

const fetchQueries = async (supabase: any, user: AdminProfile, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
        .from('student_queries')
        .select('*', { count: 'exact' })
        .eq('college', user.college)
        .order('created_at', { ascending: false })
        .range(from, to);
    
    if (error) throw error;
    return { data: data as StudentQuery[], count: count || 0 };
};

const updateQueryStatus = async (supabase: any, { queryId, newStatus }: { queryId: string, newStatus: StudentQuery['status'] }) => {
    const { error } = await supabase.from('student_queries').update({ status: newStatus }).eq('id', queryId);
    if (error) throw error;
};

const generateAiSummary = async (supabase: any, queries: StudentQuery[]) => {
    const data = await runAI({
        task: 'query-summary',
        payload: { queries: queries.map(q => q.query_message) },
        supabase,
    });
    return data.text;
};

const StudentQueries: React.FC<{ user: AdminProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    
    const { data: queriesData, isLoading } = useQuery<{ data: StudentQuery[]; count: number }, Error>({
        queryKey: ['queries', user.college, page],
        queryFn: () => fetchQueries(supabase, user, page),
        placeholderData: (previousData) => previousData,
    });
    
    const queries = queriesData?.data ?? [];
    const count = queriesData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const statusMutation = useMutation({
        mutationFn: (vars: { queryId: string, newStatus: StudentQuery['status'] }) => updateQueryStatus(supabase, vars),
        onSuccess: () => {
            toast.success("Status updated!");
            queryClient.invalidateQueries({ queryKey: ['queries', user.college] });
        },
        onError: (error) => handleAiInvocationError(error),
    });

    const summaryMutation = useMutation({
        mutationFn: (queriesToSummarize: StudentQuery[]) => generateAiSummary(supabase, queriesToSummarize),
        onSuccess: (data) => {
            setIsSummaryModalOpen(true);
        },
        onError: (error) => handleAiInvocationError(error),
    });

    const handleGenerateSummary = async () => {
        const { data: allQueriesData, error } = await supabase.from('student_queries').select('*').eq('college', user.college).eq('status', 'open').order('created_at', { ascending: false });
        if (error) {
          handleAiInvocationError(error);
          return;
        }
        const openQueries = (allQueriesData || []).slice(0, 20);

        if (openQueries.length === 0) {
            toast.error("No open queries to summarize.");
            return;
        }
        summaryMutation.mutate(openQueries);
    };
    
    return (
        <Card glow="none">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="font-display text-4xl text-primary">Student Queries</h1>
                <Button variant="secondary" onClick={handleGenerateSummary} disabled={summaryMutation.isPending}>
                    {summaryMutation.isPending ? <Spinner /> : 'Generate AI Summary'}
                </Button>
            </div>
            
            {isLoading && queries.length === 0 ? <div className="flex justify-center p-8"><Spinner /></div> : (
                <div className="space-y-4">
                    {queries.length === 0 && <p className="text-center text-text-muted">No open queries.</p>}
                    {queries.map(query => (
                        <Card key={query.id} className="border-secondary/30" glow="secondary">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-display text-xl text-secondary">{query.student_name}</h3>
                                    <p className="text-text-muted">{query.query_message}</p>
                                </div>
                                <span className={`px-3 py-1 text-sm font-bold rounded-full capitalize ${query.status === 'open' ? 'bg-red-500/50 text-red-200' : query.status === 'in_progress' ? 'bg-yellow-500/50 text-yellow-200' : 'bg-green-500/50 text-green-200'}`}>
                                    {query.status.replace('_', ' ')}
                                </span>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button className="text-xs py-1 px-2" variant="ghost" onClick={() => statusMutation.mutate({ queryId: query.id, newStatus: 'open' })}>Open</Button>
                                <Button className="text-xs py-1 px-2" variant="ghost" onClick={() => statusMutation.mutate({ queryId: query.id, newStatus: 'in_progress' })}>In Progress</Button>
                                <Button className="text-xs py-1 px-2" variant="ghost" onClick={() => statusMutation.mutate({ queryId: query.id, newStatus: 'resolved' })}>Resolved</Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

            <Modal isOpen={isSummaryModalOpen} onClose={() => setIsSummaryModalOpen(false)} title="AI Summary of Open Queries">
                {summaryMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center h-48">
                        <Spinner />
                        <p className="mt-4 text-primary">AI is analyzing queries...</p>
                    </div>
                ) : (
                    <div className="text-lg">
                        {summaryMutation.data && <MarkdownRenderer content={summaryMutation.data} />}
                        <p className="text-xs text-text-muted mt-4 border-t border-primary/20 pt-2">Analysis based on the 20 most recent open queries.</p>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default StudentQueries;