
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { AdminProfile, Department, AdminRole } from '../../types.ts';
import { UNIVERSITY_LEVEL_ROLES } from '../../types.ts';
import { useQuery } from '@tanstack/react-query';
import { BarChart, BarChartData } from '../../components/charts/BarChart.tsx';
import { Button } from '../../components/ui/Button.tsx';
import toast from 'react-hot-toast';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { downloadCsv } from '../../utils/csv.ts';

interface StatisticsPageProps {
    user: AdminProfile;
}

interface StatData {
    studentCount: number;
    opportunityCount: number;
    applicationCount: number;
    engagementRate: string;
    totalHires: number;
}

const fetchDepartments = async (supabase, college: string): Promise<Department[]> => {
    const { data, error } = await supabase
        .from('departments')
        .select('id, name, college_name')
        .eq('college_name', college)
        .order('name', { ascending: true });
    if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) return [];
        handleAiInvocationError(error);
        throw error;
    }
    return data || [];
};

const fetchStatistics = async (supabase, user: AdminProfile, departmentFilter: string | 'all') => {
    const activeDept = departmentFilter !== 'all' ? departmentFilter : user.department;
    const analyticsQuery = supabase
        .from('analytics_department_performance')
        .select('*')
        .eq('college', user.college);
    if (activeDept) analyticsQuery.eq('department', activeDept);
    const { data: analyticsRows, error: analyticsError } = await analyticsQuery;
    if (!analyticsError && analyticsRows) {
        const totals = analyticsRows.reduce((acc: any, row: any) => ({
            studentCount: acc.studentCount + Number(row.total_students || 0),
            applicationCount: acc.applicationCount + Number(row.applied_count || 0),
            totalHires: acc.totalHires + Number(row.students_placed || 0),
        }), { studentCount: 0, applicationCount: 0, totalHires: 0 });
        const { count: opportunityCount } = await supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('college', user.college);
        const engagementRate = totals.studentCount > 0 ? ((totals.applicationCount / (totals.studentCount * 5)) * 100).toFixed(1) : '0.0';
        return { ...totals, opportunityCount: opportunityCount || 0, engagementRate: `${engagementRate}%` };
    }

    let studentQuery = supabase.from('student_registry').select('*', { count: 'exact', head: true }).eq('college', user.college);
    let opportunityQuery = supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('college', user.college);
    let appQuery = supabase.from('applications').select('*', { count: 'exact', head: true });
    let hiresQuery = supabase.from('applications').select('*', { count: 'exact', head: true }).in('status', ['offered', 'hired']);

    // Filter by department if user is restricted or if a specific filter is selected
    if (activeDept) {
        studentQuery = studentQuery.eq('department', activeDept);
    }

    const [studentRes, opportunityRes, appRes, hiresRes] = await Promise.all([
        studentQuery,
        opportunityQuery,
        appQuery,
        hiresQuery
    ]);

    if (studentRes.error) throw studentRes.error;

    const studentCount = studentRes.count || 0;
    const opportunityCount = opportunityRes.count || 0;
    const applicationCount = appRes.count || 0;
    const totalHires = hiresRes.count || 0;

    const engagementRate = studentCount > 0 ? ((applicationCount / (studentCount * 5)) * 100).toFixed(1) : '0.0';

    return { studentCount, opportunityCount, applicationCount, engagementRate: `${engagementRate}%`, totalHires };
};

// Aggregates Placement Data: Group by Section if in Dept view, else by Dept
const fetchPlacementStats = async (supabase: any, user: AdminProfile, departmentFilter: string | 'all'): Promise<BarChartData[]> => {
    const activeDept = departmentFilter !== 'all' ? departmentFilter : user.department;
    const analyticsQuery = supabase
        .from('analytics_department_performance')
        .select('department, students_placed')
        .eq('college', user.college);
    if (activeDept) analyticsQuery.eq('department', activeDept);
    const { data: analyticsRows, error: analyticsError } = await analyticsQuery;
    if (!analyticsError && analyticsRows) {
        return analyticsRows.map((row: any) => ({
            label: row.department || 'General',
            value: Number(row.students_placed || 0)
        })).sort((a, b) => b.value - a.value);
    }

    // 1. Fetch relevant students
    let query = supabase.from('students').select('id, department, section').eq('college', user.college);

    if (activeDept) {
        query = query.eq('department', activeDept);
    }

    const { data: students, error: studentError } = await query;
    if (studentError) throw studentError;
    if (!students || students.length === 0) return [];

    const studentIds = students.map((s: any) => s.id);
    const studentMap = new Map<string, any>(students.map((s: any) => [s.id, s]));

    // 2. Fetch successful applications
    // We count 'offered' and 'hired' as Placed.
    const { data: placements, error: appError } = await supabase
        .from('applications')
        .select('student_id')
        .in('student_id', studentIds)
        .in('status', ['offered', 'hired']);

    if (appError) throw appError;

    // 3. Aggregate
    const counts: Record<string, number> = {};

    placements?.forEach((app: any) => {
        const student = studentMap.get(app.student_id);
        if (student) {
            // If user has a department, we breakdown by SECTION.
            // If user is university level, we breakdown by DEPARTMENT.
            let label = 'Unknown';
            if (user.department) {
                label = student.section ? `Section ${student.section}` : 'No Section';
            } else {
                label = student.department || 'General';
            }

            counts[label] = (counts[label] || 0) + 1;
        }
    });

    return Object.entries(counts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value); // Sort descending
};

const fetchTopRecruiters = async (supabase, college: string) => {
    const { data: analyticsRows, error: analyticsError } = await supabase
        .from('analytics_company_performance')
        .select('company, posted_jobs')
        .eq('college', college)
        .order('posted_jobs', { ascending: false })
        .limit(5);
    if (!analyticsError && analyticsRows) {
        return analyticsRows.map((row: any) => ({ name: row.company, count: row.posted_jobs }));
    }

    const { data } = await supabase.from('opportunities').select('company, id').eq('college', college);
    if (!data) return [];

    const companyCounts: Record<string, number> = {};
    data.forEach((o: any) => {
        companyCounts[o.company] = (companyCounts[o.company] || 0) + 1;
    });

    return Object.entries(companyCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
};

const fetchRecentHires = async (supabase, college: string) => {
    const { data, error } = await supabase
        .from('applications')
        .select(`
            id,
            status,
            created_at,
            students!inner (name, department, college),
            opportunities!inner (title, company)
        `)
        .eq('students.college', college)
        .in('status', ['offered', 'hired'])
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) return [];
    return data || [];
};

const LivePlacementPulse: React.FC<{ hires: any[] }> = ({ hires }) => {
    if (!hires || hires.length === 0) return null;

    return (
        <div className="bg-secondary/10 border-y border-secondary/20 py-2 mb-8 overflow-hidden relative">
            <div className="flex items-center gap-2 px-4 absolute left-0 top-0 h-full bg-background z-10 border-r border-secondary/20 shadow-[5px_0_10px_rgba(0,0,0,0.5)]">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-tighter text-secondary whitespace-nowrap">Live Pulse</span>
            </div>
            <div className="flex whitespace-nowrap animate-marquee hover:[animation-play-state:paused] ml-24">
                {hires.map((h, i) => (
                    <div key={i} className="inline-flex items-center gap-2 mx-8 text-xs">
                        <span className="text-primary font-bold">{h.students.name}</span>
                        <span className="text-text-muted">placed at</span>
                        <span className="text-secondary font-bold">{h.opportunities.company}</span>
                        <span className="text-[10px] text-text-muted bg-white/5 px-1.5 rounded-full">{h.opportunities.title}</span>
                        <span className="text-[9px] opacity-40 italic">{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                ))}
                {/* Duplicate for seamless loop */}
                {hires.map((h, i) => (
                    <div key={`dup-${i}`} className="inline-flex items-center gap-2 mx-8 text-xs">
                        <span className="text-primary font-bold">{h.students.name}</span>
                        <span className="text-text-muted">placed at</span>
                        <span className="text-secondary font-bold">{h.opportunities.company}</span>
                        <span className="text-[10px] text-text-muted bg-white/5 px-1.5 rounded-full">{h.opportunities.title}</span>
                        <span className="text-[9px] opacity-40 italic">{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 40s linear infinite;
                }
            `}</style>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; description: string; color?: string }> = ({ title, value, description, color = 'text-primary' }) => (
    <Card glow="primary" className="border-primary/50 text-center p-6 flex flex-col justify-center h-full">
        <h4 className="font-display text-xs md:text-sm text-text-base tracking-widest uppercase mb-2 opacity-70">{title}</h4>
        <p className={`font-display text-3xl md:text-4xl my-3 ${color}`}>{value}</p>
        <p className="text-text-muted text-xs md:text-sm">{description}</p>
    </Card>
);

export const StatisticsPage: React.FC<StatisticsPageProps> = ({ user }) => {
    const supabase = useSupabase();
    const [selectedDepartment, setSelectedDepartment] = useState<string | 'all'>(user.department || 'all');
    const isUniversityLevelAdmin = UNIVERSITY_LEVEL_ROLES.includes(user.role as AdminRole) || (!user.department && user.role === 'admin');

    const { data: stats, isLoading: isLoadingStats } = useQuery<StatData, Error>({
        queryKey: ['adminStats', user.id, user.college, user.department, selectedDepartment],
        queryFn: () => fetchStatistics(supabase, user, selectedDepartment),
        staleTime: 1000 * 60 * 5,
    });

    const { data: placementChartData, isLoading: isLoadingChart } = useQuery<BarChartData[], Error>({
        queryKey: ['placementChart', user.id, user.college, user.department, selectedDepartment],
        queryFn: () => fetchPlacementStats(supabase, user, selectedDepartment),
        staleTime: 1000 * 60 * 5,
    });

    const { data: topRecruiters = [] } = useQuery({
        queryKey: ['topRecruiters', user.college],
        queryFn: () => fetchTopRecruiters(supabase, user.college)
    });

    const { data: departments = [], isLoading: isLoadingDepartments } = useQuery<Department[]>({
        queryKey: ['departments', user.college],
        queryFn: () => fetchDepartments(supabase, user.college),
        enabled: isUniversityLevelAdmin,
    });

    const { data: recentHires = [] } = useQuery({
        queryKey: ['recentHires', user.college],
        queryFn: () => fetchRecentHires(supabase, user.college),
        refetchInterval: 1000 * 60 * 5, // 5 minutes
    });

    const chartTitle = user.department
        ? `Placements by Section (${user.department})`
        : `Placements by Department`;

    const openAdminView = (view: string) => {
        window.dispatchEvent(new CustomEvent('NEXUS_AGENT_COMMAND', { detail: { type: 'NAVIGATE', view } }));
    };

    const handleDownloadFullReport = async () => {
        const { data, error } = await supabase
            .from('analytics_student_outcomes')
            .select('*')
            .eq('college', user.college)
            .order('department', { ascending: true });
        if (error) {
            toast.error('Analytics view unavailable. Apply the scale analytics migration first.');
            return;
        }
        downloadCsv((data || []).map((row: any) => ({
            Student: row.student_name,
            Roll_Number: row.roll_number,
            Email: row.email,
            Department: row.department,
            CGPA: row.cgpa,
            Backlogs: row.backlogs,
            Applied: row.applied_count,
            Placed: row.placed_count,
            Companies: row.placed_companies || '',
            Max_Package_LPA: row.max_package_lpa || ''
        })), `${user.college.replace(/[^a-z0-9]/gi, '_')}_placement_report.csv`);
        toast.success('Placement report downloaded.');
    };

    return (
        <div>
            <header className="mb-8 text-left">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Dashboard Overview
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    Real-time institutional metrics, placement tracking, and engagement analytics.
                </p>
            </header>

            <LivePlacementPulse hires={recentHires} />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {isLoadingStats ? (
                    <div className="lg:col-span-5 flex justify-center items-center h-32"><Spinner /></div>
                ) : (
                    <>
                        <StatCard title="Total Students" value={stats?.studentCount ?? 0} description="Registered" />
                        <StatCard title="Total Jobs" value={stats?.opportunityCount ?? 0} description="Active Postings" />
                        <StatCard title="Applications" value={stats?.applicationCount ?? 0} description="Processed" />
                        <StatCard title="Offers" value={stats?.totalHires ?? 0} description="Students Placed" color="text-green-400" />
                        <StatCard title="Engagement" value={stats?.engagementRate ?? '0.0%'} description="Activity Rate" color="text-secondary" />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Main Chart */}
                <div className="lg:col-span-2">
                    <Card glow="primary" className="h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-display text-xl text-primary">{chartTitle}</h3>
                            <span className="text-xs text-text-muted bg-white/5 px-2 py-1 rounded">Offers / Hires</span>
                        </div>
                        {isLoadingChart ? (
                            <div className="flex justify-center items-center h-64"><Spinner /></div>
                        ) : (
                            <BarChart data={placementChartData || []} />
                        )}
                    </Card>
                </div>

                {/* Top Recruiters */}
                <Card glow="secondary" className="theme-professional:!bg-[#fffdf7] theme-professional:!border-[#eadccb]">
                    <h3 className="font-display text-xl text-secondary theme-professional:text-[#0f766e] mb-4">Recruiters</h3>
                    <div className="space-y-4">
                        {topRecruiters.length === 0 && <p className="text-text-muted">No data yet.</p>}
                        {topRecruiters.map((r, i) => (
                            <div key={i} className="flex justify-between items-center bg-black/20 theme-professional:!bg-[#fff8ed] p-3 rounded border border-white/5 theme-professional:!border-[#eadccb]">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-text-muted theme-professional:text-[#8a7c70] w-4">#{i + 1}</span>
                                    <span className="font-bold text-text-base">{r.name}</span>
                                </div>
                                <span className="text-primary theme-professional:text-[#c2410c] font-mono">{r.count}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Quick Actions / Search */}
            <Card glow="none" className="p-6 bg-gradient-to-r from-card-bg to-primary/5 theme-professional:!bg-[#fffdf7] theme-professional:!border-[#eadccb]">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                            <h2 className="font-display text-2xl text-text-base theme-professional:text-[#171717] mb-1">Quick Actions</h2>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            {isUniversityLevelAdmin && (
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    className="bg-black/30 theme-professional:!bg-[#fff8ed] border border-primary/30 theme-professional:!border-[#d9c7b5] rounded-md p-2 text-text-base outline-none focus:border-primary"
                                >
                                    <option value="all">Departments</option>
                                    {departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}
                                </select>
                            )}
                            <Button variant="secondary" onClick={handleDownloadFullReport}>Download Report</Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <button onClick={() => openAdminView('students-hub')} className="bg-black/20 theme-professional:!bg-[#fff8ed] hover:bg-primary/10 theme-professional:hover:!bg-[#f6e7d7] border border-white/10 theme-professional:!border-[#eadccb] hover:border-primary/40 rounded-md p-3 text-left transition-all">
                            <span className="material-symbols-outlined text-primary theme-professional:text-[#c2410c] text-xl">groups</span>
                            <p className="font-bold text-sm mt-1">Students</p>
                        </button>
                        <button onClick={() => openAdminView('student-performance')} className="bg-black/20 theme-professional:!bg-[#fff8ed] hover:bg-primary/10 theme-professional:hover:!bg-[#f6e7d7] border border-white/10 theme-professional:!border-[#eadccb] hover:border-primary/40 rounded-md p-3 text-left transition-all">
                            <span className="material-symbols-outlined text-secondary theme-professional:text-[#0f766e] text-xl">analytics</span>
                            <p className="font-bold text-sm mt-1">Analytics</p>
                        </button>
                        <button onClick={() => openAdminView('student-registry')} className="bg-black/20 theme-professional:!bg-[#fff8ed] hover:bg-primary/10 theme-professional:hover:!bg-[#f6e7d7] border border-white/10 theme-professional:!border-[#eadccb] hover:border-primary/40 rounded-md p-3 text-left transition-all">
                            <span className="material-symbols-outlined text-primary theme-professional:text-[#c2410c] text-xl">storage</span>
                            <p className="font-bold text-sm mt-1">Registry</p>
                        </button>
                        <button onClick={() => openAdminView('opportunities')} className="bg-black/20 theme-professional:!bg-[#fff8ed] hover:bg-primary/10 theme-professional:hover:!bg-[#f6e7d7] border border-white/10 theme-professional:!border-[#eadccb] hover:border-primary/40 rounded-md p-3 text-left transition-all">
                            <span className="material-symbols-outlined text-secondary theme-professional:text-[#0f766e] text-xl">business_center</span>
                            <p className="font-bold text-sm mt-1">Drives</p>
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
