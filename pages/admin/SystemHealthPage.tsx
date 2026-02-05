
import React, { useState } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Pagination } from '../../components/ui/Pagination.tsx';
import toast from 'react-hot-toast';
import type { PlatformIssue, AdminProfile } from '../../types.ts';

const PAGE_SIZE = 10;

const fetchIssues = async (supabase: any, page: number, status: string) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    let query = supabase
        .from('platform_issues')
        .select('*', { count: 'exact' });

    if (status !== 'All') {
        query = query.eq('status', status);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
    
    if (error) throw error;
    return { data: data as PlatformIssue[], count: count || 0 };
};

const updateIssueStatus = async (supabase: any, id: string, status: string) => {
    const { error } = await supabase.from('platform_issues').update({ status }).eq('id', id);
    if (error) throw error;
};

const SystemHealthPage: React.FC<{ user: AdminProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedIssue, setSelectedIssue] = useState<PlatformIssue | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['platformIssues', page, statusFilter],
        queryFn: () => fetchIssues(supabase, page, statusFilter)
    });

    const issues = data?.data || [];
    const count = data?.count || 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string, status: string }) => updateIssueStatus(supabase, id, status),
        onSuccess: () => {
            toast.success("Issue status updated.");
            queryClient.invalidateQueries({ queryKey: ['platformIssues'] });
            setSelectedIssue(null);
        },
        onError: (e: any) => toast.error(e.message)
    });

    const getStatusColor = (s: string) => {
        if (s === 'Open') return 'bg-red-500/20 text-red-400 border-red-500/50';
        if (s === 'In Progress') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
        return 'bg-green-500/20 text-green-400 border-green-500/50';
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="font-display text-4xl text-primary">System Health & Support</h1>
                <div className="flex gap-2">
                    {['All', 'Open', 'In Progress', 'Resolved'].map(s => (
                        <button 
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${statusFilter === s ? 'bg-primary text-black border-primary' : 'bg-transparent border-white/20 text-text-muted hover:border-white/50'}`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <Card glow="none">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-white/10 text-text-muted uppercase text-xs">
                                    <tr>
                                        <th className="p-3">Reported By</th>
                                        <th className="p-3">Role</th>
                                        <th className="p-3">Description</th>
                                        <th className="p-3">Occurred At</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {issues.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-text-muted">No issues found.</td></tr>}
                                    {issues.map(issue => (
                                        <tr key={issue.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-bold text-white">{issue.reporter_name}</td>
                                            <td className="p-3 text-secondary capitalize">{issue.reporter_role}</td>
                                            <td className="p-3 max-w-xs truncate" title={issue.description}>{issue.description}</td>
                                            <td className="p-3 text-text-muted">{new Date(issue.occurred_at).toLocaleString()}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${getStatusColor(issue.status)}`}>
                                                    {issue.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button variant="ghost" className="text-xs py-1 px-2" onClick={() => setSelectedIssue(issue)}>View Details</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </>
                )}
            </Card>

            {selectedIssue && (
                <Modal isOpen={!!selectedIssue} onClose={() => setSelectedIssue(null)} title="Issue Details">
                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-lg font-bold text-primary">{selectedIssue.reporter_name}</p>
                                <p className="text-sm text-text-muted">{selectedIssue.reporter_role} • {new Date(selectedIssue.created_at).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <select 
                                    value={selectedIssue.status}
                                    onChange={(e) => statusMutation.mutate({ id: selectedIssue.id, status: e.target.value })}
                                    className="bg-black/30 border border-primary/30 rounded px-2 py-1 text-sm text-white"
                                >
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Resolved">Resolved</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-black/20 p-4 rounded border border-white/10">
                            <h4 className="text-sm text-secondary font-bold mb-2">Description</h4>
                            <p className="whitespace-pre-wrap">{selectedIssue.description}</p>
                        </div>

                        <div>
                            <h4 className="text-sm text-secondary font-bold mb-2">Screenshot</h4>
                            {selectedIssue.screenshot_url ? (
                                <a href={selectedIssue.screenshot_url} target="_blank" rel="noreferrer">
                                    <img src={selectedIssue.screenshot_url} alt="Screenshot" className="max-w-full h-auto rounded border border-white/20 hover:opacity-90 transition-opacity" />
                                </a>
                            ) : (
                                <p className="text-sm text-text-muted italic">No screenshot provided.</p>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SystemHealthPage;
