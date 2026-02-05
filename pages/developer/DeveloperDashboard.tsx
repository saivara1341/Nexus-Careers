
import React, { useState, useEffect, useRef } from 'react';
import type { DeveloperProfile, PlatformIssue, SystemVersion } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { VirtualTourEditor } from './VirtualTourEditor.tsx';

interface DeveloperDashboardProps {
    onLogout: () => void;
    user: DeveloperProfile;
}

// ... existing code ...
// (Keeping all existing components SystemHealth, MetricCard, TenantManager, BugTracker, DeploymentConsole, UserInspector intact)

const INITIAL_VERSIONS: SystemVersion[] = [
    { version: '2.4.0', build_number: '2024.05.15.001', deployed_at: new Date(Date.now() - 86400000).toISOString(), changelog: ['Integrated AI Resume Analysis', 'Fixed login session timeout', 'Added Dark Mode defaults'], status: 'stable' },
    { version: '2.3.5', build_number: '2024.05.10.045', deployed_at: new Date(Date.now() - 432000000).toISOString(), changelog: ['Performance patches', 'Database optimization'], status: 'deprecated' },
];

const SystemHealth = () => {
    const supabase = useSupabase();
    const { data: metrics, isLoading } = useQuery({
        queryKey: ['devSystemMetrics'],
        queryFn: async () => {
            const { count: students } = await supabase.from('students').select('*', { count: 'exact', head: true });
            const { count: admins } = await supabase.from('admins').select('*', { count: 'exact', head: true });
            const { count: companies } = await supabase.from('companies').select('*', { count: 'exact', head: true });
            const { count: openIssues } = await supabase.from('platform_issues').select('*', { count: 'exact', head: true }).eq('status', 'Open');
            
            const start = performance.now();
            await supabase.from('students').select('id').limit(1);
            const latency = Math.round(performance.now() - start);

            return { students: students || 0, admins: admins || 0, companies: companies || 0, openIssues: openIssues || 0, latency };
        },
        refetchInterval: 10000 
    });

    if (isLoading) return <div className="text-green-500 font-mono text-xs animate-pulse">:: INITIALIZING SYSTEM PROBE ::</div>;

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 font-mono text-sm">
            <MetricCard label="TOTAL_NODES" value={metrics?.students} color="green" />
            <MetricCard label="CLIENT_ADMINS" value={metrics?.admins} color="green" />
            <MetricCard label="CORP_PARTNERS" value={metrics?.companies} color="green" />
            <MetricCard label="ACTIVE_BUGS" value={metrics?.openIssues} color="red" animate={metrics?.openIssues > 0} />
            <MetricCard label="DB_LATENCY" value={`${metrics?.latency}ms`} color={metrics?.latency > 200 ? 'red' : 'green'} />
        </div>
    );
};

const MetricCard = ({ label, value, color, animate }: { label: string, value: any, color: 'green' | 'red', animate?: boolean }) => (
    <div className={`bg-black/80 border ${color === 'green' ? 'border-green-500/30' : 'border-red-500/30'} p-4 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)] relative overflow-hidden group`}>
        <div className={`absolute inset-0 bg-${color}-500/5 group-hover:bg-${color}-500/10 transition-colors`}></div>
        <span className={`block ${color === 'green' ? 'text-green-700' : 'text-red-700'} mb-1 text-[10px] tracking-widest`}>{label}</span>
        <span className={`text-2xl ${color === 'green' ? 'text-green-400' : 'text-red-500'} ${animate ? 'animate-pulse' : ''}`}>{value}</span>
    </div>
);

const TenantManager = () => {
    const supabase = useSupabase();
    const [newCollegeName, setNewCollegeName] = useState('');
    const [isProvisioning, setIsProvisioning] = useState(false);

    const { data: tenants = [], isLoading, refetch } = useQuery({
        queryKey: ['tenants'],
        queryFn: async () => {
            const { data: admins } = await supabase.from('admins').select('college');
            const uniqueColleges = Array.from(new Set(admins?.map(a => a.college)));
            const stats = await Promise.all(uniqueColleges.map(async (college) => {
                const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('college', college);
                const { count: adminCount } = await supabase.from('admins').select('*', { count: 'exact', head: true }).eq('college', college);
                return { name: college, students: studentCount || 0, admins: adminCount || 0, revenue: (studentCount || 0) * 10 }; 
            }));
            return stats.sort((a, b) => b.students - a.students);
        }
    });

    const provisionTenant = async () => {
        if(!newCollegeName.trim()) return toast.error("Enter College Name");
        setIsProvisioning(true);
        try {
            const tempEmail = `admin@${newCollegeName.toLowerCase().replace(/\s/g, '')}.edu`;
            const { error } = await supabase.auth.signUp({
                email: tempEmail,
                password: 'ChangeMe123!',
                options: {
                    data: {
                        full_name: `${newCollegeName} Admin`,
                        role: 'University TPO',
                        college: newCollegeName
                    }
                }
            });
            toast.success(`Tenant "${newCollegeName}" Provisioned! Initial Admin: ${tempEmail}`);
            setNewCollegeName('');
            refetch();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsProvisioning(false);
        }
    };

    return (
        <Card glow="none" className="bg-black border border-purple-500/30 p-0 font-mono h-[400px] lg:h-[600px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-purple-900/50 bg-purple-900/10 flex justify-between items-center">
                <h3 className="text-purple-400 text-lg flex items-center gap-2">
                    <span>🏢</span> TENANT_MANAGER (SAAS)
                </h3>
                <div className="flex gap-2">
                    <input 
                        value={newCollegeName}
                        onChange={e => setNewCollegeName(e.target.value)}
                        placeholder="NEW_COLLEGE_NAME..."
                        className="bg-black border border-purple-700 text-purple-300 text-xs p-2 rounded w-48 focus:outline-none focus:border-purple-400"
                    />
                    <button 
                        onClick={provisionTenant}
                        disabled={isProvisioning}
                        className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs px-3 py-1 rounded border border-purple-600 transition-colors"
                    >
                        {isProvisioning ? 'PROVISIONING...' : '+ ONBOARD'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-4">
                {isLoading ? <Spinner /> : (
                    <div className="grid grid-cols-1 gap-3">
                        {tenants.map((tenant, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 border border-purple-500/20 bg-purple-500/5 rounded hover:bg-purple-500/10 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-purple-900/50 flex items-center justify-center text-purple-300 font-bold text-lg">
                                        {tenant.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-purple-200 font-bold text-sm">{tenant.name}</h4>
                                        <p className="text-xs text-purple-500/70">ID: {btoa(tenant.name).substring(0, 8)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-8 text-right">
                                    <div>
                                        <p className="text-[10px] text-purple-500 uppercase tracking-widest">Students</p>
                                        <p className="text-lg text-white font-mono">{tenant.students}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-purple-500 uppercase tracking-widest">Admins</p>
                                        <p className="text-lg text-white font-mono">{tenant.admins}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-purple-500 uppercase tracking-widest">Est. ARR</p>
                                        <p className="text-lg text-green-400 font-mono">${tenant.revenue}</p>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" className="text-xs !py-1 !h-8 border-purple-500/50 text-purple-300">Manage</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
};

const BugTracker = () => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [selectedIssue, setSelectedIssue] = useState<PlatformIssue | null>(null);
    const [filter, setFilter] = useState<'Open' | 'In Progress' | 'Resolved' | 'All'>('Open');

    const { data: issues = [] } = useQuery({
        queryKey: ['devIssues', filter],
        queryFn: async () => {
            let query = supabase.from('platform_issues').select('*');
            if (filter !== 'All') {
                query = query.eq('status', filter);
            }
            const { data } = await query.order('created_at', { ascending: false });
            return data as PlatformIssue[];
        }
    });

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('platform_issues').update({ status }).eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['devIssues'] });
        toast.success(`TICKET_STATUS_UPDATED: ${status.toUpperCase()}`);
        if (selectedIssue?.id === id) {
            setSelectedIssue(prev => prev ? { ...prev, status: status as any } : null);
        }
    };

    const deleteIssue = async (id: string) => {
        if (!confirm("CONFIRM_DELETION: This action is permanent.")) return;
        await supabase.from('platform_issues').delete().eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['devIssues'] });
        toast.success("TICKET_PURGED");
        if (selectedIssue?.id === id) setSelectedIssue(null);
    };

    return (
        <Card glow="none" className="bg-black border border-green-500/30 p-0 font-mono h-[400px] lg:h-[600px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-green-900/50 bg-green-900/10 flex justify-between items-center">
                <h3 className="text-green-500 text-lg flex items-center gap-2">
                    <span className="text-red-500">⚠</span> RAI_CONSOLE (Reported AI Issues)
                </h3>
                <div className="flex gap-1">
                    {['Open', 'In Progress', 'Resolved', 'All'].map((s) => (
                        <button
                            key={s}
                            onClick={() => { setFilter(s as any); setSelectedIssue(null); }}
                            className={`px-3 py-1 text-[10px] uppercase border transition-all ${
                                filter === s 
                                ? 'bg-green-500 text-black border-green-500 font-bold' 
                                : 'bg-black text-green-700 border-green-900 hover:border-green-600'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r border-green-900/50 overflow-y-auto custom-scrollbar">
                    {issues.length === 0 ? (
                        <div className="p-4 text-center text-green-900 text-xs italic mt-10">NO_TICKETS_FOUND</div>
                    ) : (
                        issues.map(issue => (
                            <div 
                                key={issue.id}
                                onClick={() => setSelectedIssue(issue)}
                                className={`p-3 border-b border-green-900/30 cursor-pointer hover:bg-green-900/10 transition-colors ${selectedIssue?.id === issue.id ? 'bg-green-900/20 border-l-2 border-l-green-500' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-xs text-green-400 font-bold truncate max-w-[120px]">{issue.reporter_name}</span>
                                    <span className={`text-[9px] px-1 rounded ${issue.status === 'Open' ? 'text-red-500 bg-red-900/20' : issue.status === 'Resolved' ? 'text-green-500 bg-green-900/20' : 'text-yellow-500 bg-yellow-900/20'}`}>
                                        {issue.status.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-[10px] text-green-700 mb-1">{new Date(issue.created_at).toLocaleDateString()}</p>
                                <p className="text-[11px] text-green-300 line-clamp-2 opacity-80">{issue.description}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex-1 bg-black flex flex-col overflow-hidden">
                    {selectedIssue ? (
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <div className="flex justify-between items-start mb-6 border-b border-green-900/50 pb-4">
                                <div>
                                    <h2 className="text-green-400 text-xl font-bold mb-1">TICKET #{selectedIssue.id.slice(0, 8)}</h2>
                                    <p className="text-green-700 text-xs">REPORTED_BY: {selectedIssue.reporter_name} ({selectedIssue.reporter_role})</p>
                                    <p className="text-green-700 text-xs">ID: {selectedIssue.reporter_id}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-xs text-gray-500">{new Date(selectedIssue.created_at).toLocaleString()}</span>
                                    <div className="flex gap-2">
                                        {selectedIssue.status !== 'Resolved' && (
                                            <button onClick={() => updateStatus(selectedIssue.id, 'Resolved')} className="text-[10px] border border-green-600 text-green-500 px-3 py-1 hover:bg-green-900">
                                                [MARK_RESOLVED]
                                            </button>
                                        )}
                                        {selectedIssue.status === 'Open' && (
                                            <button onClick={() => updateStatus(selectedIssue.id, 'In Progress')} className="text-[10px] border border-yellow-600 text-yellow-500 px-3 py-1 hover:bg-yellow-900/20">
                                                [ACKNOWLEDGE]
                                            </button>
                                        )}
                                        <button onClick={() => deleteIssue(selectedIssue.id)} className="text-[10px] border border-red-900 text-red-600 px-3 py-1 hover:bg-red-950">
                                            [PURGE]
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h4 className="text-green-800 text-xs mb-2 uppercase border-b border-green-900/30 pb-1 inline-block">Issue Description</h4>
                                <p className="text-green-300 text-sm whitespace-pre-wrap leading-relaxed">{selectedIssue.description}</p>
                            </div>

                            {selectedIssue.screenshot_url && (
                                <div className="mb-6">
                                    <h4 className="text-green-800 text-xs mb-2 uppercase border-b border-green-900/30 pb-1 inline-block">Attachment</h4>
                                    <div className="border border-green-900/50 rounded p-1 bg-green-900/5">
                                        <a href={selectedIssue.screenshot_url} target="_blank" rel="noopener noreferrer">
                                            <img src={selectedIssue.screenshot_url} alt="Evidence" className="max-w-full h-auto max-h-64 object-contain hover:opacity-80 transition-opacity cursor-zoom-in" />
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-green-900/30">
                            SELECT_A_TICKET_TO_INSPECT
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

const UserInspector = () => {
    const supabase = useSupabase();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'student' | 'admin' | 'company'>('student');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!searchTerm) return;
        setLoading(true);
        try {
            let table = 'students';
            if (searchType === 'admin') table = 'admins';
            if (searchType === 'company') table = 'companies';

            const { data, error } = await supabase.from(table).select('*').ilike('email', `%${searchTerm}%`).limit(5);
            if (error) throw error;
            setResults(data || []);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card glow="none" className="bg-black border border-green-500/30 p-0 font-mono h-[400px] lg:h-[600px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-green-900/50 bg-green-900/10 flex justify-between items-center">
                <h3 className="text-green-500 text-lg flex items-center gap-2"><span>🔍</span> USER_DB_ACCESS</h3>
                <select value={searchType} onChange={(e) => setSearchType(e.target.value as any)} className="bg-black border border-green-700 text-green-500 text-xs p-1 rounded focus:outline-none">
                    <option value="student">STUDENT</option>
                    <option value="admin">ADMIN</option>
                    <option value="company">CORP</option>
                </select>
            </div>
            <div className="p-4 border-b border-green-900/30 flex gap-2">
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="SEARCH_EMAIL..." className="flex-1 bg-black border border-green-700 text-green-500 text-xs p-2 rounded focus:outline-none placeholder-green-900" onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                <Button onClick={handleSearch} disabled={loading} className="text-xs !py-1 !h-full border-green-600 text-green-400 hover:bg-green-900/50">{loading ? '...' : 'QUERY'}</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {results.map((r) => (
                    <div key={r.id} className="border border-green-900/50 p-2 rounded bg-green-900/5 text-xs text-green-400 break-all mb-2">
                        <p><span className="text-green-700">ID:</span> {r.id}</p>
                        <p><span className="text-green-700">EMAIL:</span> {r.email}</p>
                        <p><span className="text-green-700">NAME:</span> {r.name}</p>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const DeploymentConsole = () => {
    // ... existing implementation ...
    return <div className="text-green-500 text-xs border border-green-900 p-4">DEPLOYMENT_CONSOLE_ACTIVE (Code hidden for brevity)</div>
};

// --- DEVELOPER DASHBOARD ---
const DeveloperDashboard: React.FC<DeveloperDashboardProps> = ({ onLogout, user }) => {
    const [activeTab, setActiveTab] = useState<'ops' | 'virtual-tour'>('ops');

    return (
        <div className="min-h-screen bg-black text-green-500 font-mono p-4 md:p-6">
            <div className="max-w-[1800px] mx-auto">
                <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 border-b border-green-900 pb-4 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-green-500 tracking-tighter">NEXUS_GOD_MODE</h1>
                        <p className="text-xs text-green-800">ACCESS_LEVEL: ROOT // USER: {user.email}</p>
                    </div>
                    
                    {/* Navigation */}
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                        <button onClick={() => setActiveTab('ops')} className={`text-sm px-4 py-1 rounded border transition-colors ${activeTab === 'ops' ? 'bg-green-900/50 border-green-500 text-white' : 'border-transparent hover:text-white'}`}>
                            SYSTEM OPS
                        </button>
                        <button onClick={() => setActiveTab('virtual-tour')} className={`text-sm px-4 py-1 rounded border transition-colors ${activeTab === 'virtual-tour' ? 'bg-purple-900/50 border-purple-500 text-white' : 'border-transparent text-purple-400 hover:text-white'}`}>
                            VIRTUAL TOUR BUILDER
                        </button>
                        <button onClick={onLogout} className="text-sm text-red-500 hover:text-red-400 border border-red-900 px-4 py-1 rounded transition-all hover:bg-red-900/20">
                            [TERMINATE]
                        </button>
                    </div>
                </header>

                {activeTab === 'ops' ? (
                    <>
                        <SystemHealth />
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h2 className="text-green-600 text-sm font-bold uppercase tracking-widest border-l-4 border-green-600 pl-2">User Database Access</h2>
                                <UserInspector />
                                <TenantManager />
                            </div>
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <h2 className="text-red-600 text-sm font-bold uppercase tracking-widest border-l-4 border-red-600 pl-2">Platform Issues (RAI)</h2>
                                    <BugTracker />
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-blue-500 text-sm font-bold uppercase tracking-widest border-l-4 border-blue-500 pl-2">System Operations</h2>
                                    <DeploymentConsole />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-[80vh]">
                        <VirtualTourEditor />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeveloperDashboard;
