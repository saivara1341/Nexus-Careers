import React, { useState } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Pagination } from '../../components/ui/Pagination.tsx';

const PAGE_SIZE = 20;

const fetchAdminLogs = async (supabase: any, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
        .from('admin_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) throw error;
    return { data, count: count || 0 };
};

const AdminLogsPage: React.FC = () => {
    const supabase = useSupabase();
    const [page, setPage] = useState(1);

    const { data: logsData, isLoading } = useQuery({
        queryKey: ['admin_logs', page],
        queryFn: () => fetchAdminLogs(supabase, page),
    });

    const logs = logsData?.data || [];
    const count = logsData?.count || 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-green-400';
            case 'UPDATE': return 'text-yellow-400';
            case 'DELETE': return 'text-red-400';
            default: return 'text-primary';
        }
    };

    return (
        <div className="space-y-6">
            <header className="mb-8">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Forensic Logs
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    Real-time institutional audit trail. Secure monitoring of all administrative state changes.
                </p>
            </header>

            <Card glow="none" className="border-primary/20 overflow-hidden">
                {isLoading ? (
                    <div className="flex justify-center p-12"><Spinner /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-primary/5 uppercase text-[10px] tracking-widest font-bold text-text-muted border-b border-primary/20">
                                <tr>
                                    <th className="p-4">Timestamp</th>
                                    <th className="p-4">Administrator</th>
                                    <th className="p-4">Action</th>
                                    <th className="p-4">Entity</th>
                                    <th className="p-4">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-text-muted italic">No forensic logs found yet.</td>
                                    </tr>
                                )}
                                {logs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 font-mono text-xs text-secondary whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-4 font-medium text-white">
                                            {log.admin_name}
                                        </td>
                                        <td className={`p-4 font-bold ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-white/5 px-2 py-1 rounded text-[10px] uppercase font-bold text-text-muted">
                                                {log.entity_type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-text-muted max-w-md truncate">
                                            {JSON.stringify(log.details)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </Card>
        </div>
    );
};

export default AdminLogsPage;
