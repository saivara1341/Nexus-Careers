
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { AdminProfile } from '../../types.ts';

const RegistrarDesk: React.FC<{ user: AdminProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'requests' | 'repository'>('requests');

    // Using any since these tables are virtual in the ERP context for now
    const { data: requests = [], isLoading: loadingReqs } = useQuery({
        queryKey: ['docRequests', user.college],
        queryFn: async () => {
            const { data } = await supabase.from('student_queries').select('*').eq('college', user.college).ilike('query_message', '%certificate%');
            return data || [];
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="font-display text-4xl text-primary">Registrar HQ</h1>
                    <p className="text-text-muted">Document Control & Certificate Custody</p>
                </div>
                <div className="flex bg-card-bg border border-white/10 p-1 rounded">
                    <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 text-xs font-bold transition-all ${activeTab === 'requests' ? 'bg-primary text-black' : 'text-text-muted'}`}>Pending Requests</button>
                    <button onClick={() => setActiveTab('repository')} className={`px-4 py-2 text-xs font-bold transition-all ${activeTab === 'repository' ? 'bg-secondary text-black' : 'text-text-muted'}`}>Vault Access</button>
                </div>
            </div>

            {activeTab === 'requests' && (
                <Card glow="none" className="p-0 border-white/10 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-text-muted uppercase text-[10px] tracking-widest font-black">
                            <tr>
                                <th className="p-4">Student</th>
                                <th className="p-4">Document Type</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loadingReqs ? <tr><td colSpan={4} className="p-8 text-center"><Spinner /></td></tr> : requests.map((req: any) => (
                                <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-white">{req.student_name}</p>
                                        <p className="text-[10px] text-text-muted font-mono">{req.student_id.slice(0,8)}</p>
                                    </td>
                                    <td className="p-4 uppercase font-bold text-primary text-xs">Bonafide / Study</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/20 text-blue-400`}>Requested</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button variant="ghost" className="text-[10px] py-1">Process</Button>
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && !loadingReqs && <tr><td colSpan={4} className="p-8 text-center text-text-muted italic">No active document requests.</td></tr>}
                        </tbody>
                    </table>
                </Card>
            )}

            {activeTab === 'repository' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                    <Card glow="primary" className="bg-primary/5">
                        <h3 className="text-xl font-display text-primary mb-4">Vault Audit</h3>
                        <p className="text-sm text-text-muted mb-4">Institutional custody of original documents for placement compliance.</p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs"><span className="text-text-muted">SSC Memos:</span> <span className="text-white font-bold">240</span></div>
                            <div className="flex justify-between text-xs"><span className="text-text-muted">Intermediate:</span> <span className="text-white font-bold">185</span></div>
                        </div>
                    </Card>
                    
                    <Card glow="secondary" className="md:col-span-2">
                        <h3 className="text-xl font-display text-white mb-6">Original Document Search</h3>
                        <div className="flex gap-3 mb-6">
                            <Input placeholder="Enter Roll Number to trace originals..." className="flex-1" />
                            <Button>Search Vault</Button>
                        </div>
                        <div className="p-12 border border-dashed border-white/10 rounded text-center italic text-text-muted">
                            Enter roll number to see physical custody status.
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default RegistrarDesk;
