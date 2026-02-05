

import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { AdminProfile, Department, AdminRole, StudentProfile, StudentCertification, StudentAchievement } from '../../types.ts';
import { UNIVERSITY_LEVEL_ROLES } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import toast from 'react-hot-toast';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import * as XLSX from 'xlsx';
import { runAI } from '../../services/aiClient.ts';

interface StudentPerformanceData extends StudentProfile {
    detention_risk: 'None' | 'At Risk' | 'High Risk';
    performance_status: 'High' | 'Moderate' | 'Low' | 'Poor';
    application_count: number;
    offers_count: number;
}

const PAGE_SIZE = 20;

// Copy Helper
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast.success('Copied!', { icon: '📋', duration: 1500, style: { fontSize: '12px', padding: '8px' } });
    };
    return (
        <button onClick={handleCopy} className="ml-2 text-text-muted hover:text-primary transition-colors" title="Copy">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
    );
};

const fetchDepartments = async (supabase: any, college: string) => {
    const { data } = await supabase.from('departments').select('id, name').eq('college_name', college);
    return data || [];
};

const fetchStudentsForPerformance = async (supabase: any, user: AdminProfile, page: number, department: string, passoutYear: string) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // 1. Primary Source: Student Registry
    let query = supabase
        .from('student_registry')
        .select('*', { count: 'exact' })
        .eq('college', user.college);

    if (department !== 'all') query = query.eq('department', department);
    if (passoutYear !== 'all') query = query.eq('ug_passout_year', parseInt(passoutYear));

    // FIX: Default order to roll_number instead of name to maintain logical numerical sequence
    const { data: registryData, error, count } = await query.order('roll_number', { ascending: true }).range(from, to);
    if (error) throw error;

    if (!registryData || registryData.length === 0) return { data: [], count: 0 };

    // 2. Fetch Active Student Data (XP, ID for Foreign Keys)
    const emails = registryData.map((r: any) => r.email).filter(Boolean);
    let activeMap = new Map();
    let activeIds: string[] = [];

    if (emails.length > 0) {
        const { data: activeStudents } = await supabase
            .from('students')
            .select('id, email, xp, level')
            .in('email', emails);

        if (activeStudents) {
            activeStudents.forEach((s: any) => {
                activeMap.set(s.email, s);
                activeIds.push(s.id);
            });
        }
    }

    // 3. Fetch Application Counts for Active Students
    let appCounts = new Map<string, number>();
    let offerCounts = new Map<string, number>();

    if (activeIds.length > 0) {
        const { data: apps } = await supabase
            .from('applications')
            .select('student_id, status')
            .in('student_id', activeIds);

        if (apps) {
            apps.forEach((a: any) => {
                appCounts.set(a.student_id, (appCounts.get(a.student_id) || 0) + 1);
                if (['offered', 'hired'].includes(a.status)) {
                    offerCounts.set(a.student_id, (offerCounts.get(a.student_id) || 0) + 1);
                }
            });
        }
    }

    // 4. Merge Data
    const studentsWithMetrics = registryData.map((regStudent: any) => {
        const activeData = activeMap.get(regStudent.email);
        const activeId = activeData?.id;

        const cgpa = regStudent.ug_cgpa || 0;
        const backlogs = regStudent.backlogs || 0;

        // Risk Logic
        let risk: StudentPerformanceData['detention_risk'] = 'None';
        if (backlogs > 3 || cgpa < 5.0) risk = 'High Risk';
        else if (backlogs > 0 || cgpa < 6.0) risk = 'At Risk';

        // Performance Logic
        let perf: StudentPerformanceData['performance_status'] = 'Moderate';
        if (cgpa >= 8.5 && backlogs === 0) perf = 'High';
        else if (cgpa >= 6.0 && cgpa < 8.5) perf = 'Moderate';
        else if (cgpa >= 5.0 && cgpa < 6.0 && backlogs === 0) perf = 'Low';
        else perf = 'Poor';

        return {
            ...regStudent,
            id: activeId || regStudent.id,
            role: 'student',
            xp: activeData?.xp || 0,
            level: activeData?.level || 1,
            detention_risk: risk,
            performance_status: perf,
            application_count: activeId ? (appCounts.get(activeId) || 0) : 0,
            offers_count: activeId ? (offerCounts.get(activeId) || 0) : 0
        };
    });

    return { data: studentsWithMetrics as StudentPerformanceData[], count: count || 0 };
};

const generateAIDetentionReport = async (supabase: any, students: StudentPerformanceData[], department: string, viewMode: 'academic' | 'placement') => {
    const metrics = {
        department,
        viewMode,
        totalStudents: students.length,
        highRiskCount: students.filter(s => s.detention_risk === 'High Risk').length,
        averageCGPA: students.reduce((acc, s) => acc + (s.ug_cgpa || 0), 0) / students.length,
        totalApplications: students.reduce((acc, s) => acc + (s.application_count || 0), 0),
        activeStudents: students.filter(s => s.application_count > 0).length,
    };

    const data = await runAI({
        task: 'detention-risk-analysis',
        payload: { metrics, customPrompt: viewMode === 'placement' ? "Analyze placement activity. Focus on application rates vs academic standing." : undefined },
        supabase,
    });
    return data.text;
};

interface StudentPerformancePageProps {
    user: AdminProfile;
}

const StudentPerformancePage: React.FC<StudentPerformancePageProps> = ({ user }) => {
    const supabase = useSupabase();
    const [page, setPage] = useState(1);
    const isUserAdminRole = (role: AdminRole | 'admin'): role is AdminRole => role !== 'admin';
    const isUniversityLevelAdmin = isUserAdminRole(user.role) && UNIVERSITY_LEVEL_ROLES.includes(user.role) || (!isUserAdminRole(user.role) && user.role === 'admin') || !user.department;

    const [filterDepartment, setFilterDepartment] = useState<string | 'all'>(user.department || 'all');
    const [filterPassoutYear, setFilterPassoutYear] = useState<string | 'all'>('all');
    const [aiReport, setAiReport] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<'academic' | 'placement'>('academic');
    const [selectedStudent, setSelectedStudent] = useState<StudentPerformanceData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: departments = [], isLoading: isLoadingDepartments } = useQuery<Department[]>({
        queryKey: ['departments', user.college],
        queryFn: () => fetchDepartments(supabase, user.college),
        enabled: isUniversityLevelAdmin,
    });

    const { data: studentsData, isLoading: isLoadingStudents, isError, error } = useQuery<{ data: StudentPerformanceData[]; count: number }, Error>({
        queryKey: ['studentPerformance', user.college, filterDepartment, filterPassoutYear, page],
        queryFn: async () => {
            try {
                return await fetchStudentsForPerformance(supabase, user, page, filterDepartment, filterPassoutYear);
            } catch (err: any) {
                const errorMessage = handleAiInvocationError(err);
                throw new Error(errorMessage);
            }
        },
        placeholderData: (previousData) => previousData,
    });

    const students = studentsData?.data ?? [];
    const count = studentsData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const detentionReportMutation = useMutation<string, Error, void>({
        mutationFn: async () => {
            if (students.length === 0) throw new Error("No students loaded.");
            try {
                return await generateAIDetentionReport(supabase, students, user.department || filterDepartment, viewMode);
            } catch (err: any) {
                const errorMessage = handleAiInvocationError(err);
                throw new Error(errorMessage);
            }
        },
        onSuccess: (report) => {
            setAiReport(report);
            toast.success(`AI ${viewMode} report generated!`);
        },
    });

    const handleExport = () => {
        if (!students.length) {
            toast.error("No student data available to export.");
            return;
        }

        const exportData = students.map(s => ({
            'Name': s.name,
            'Roll Number': s.roll_number,
            'Department': s.department,
            'Email': s.email,
            'Mobile': s.mobile_number || 'N/A',
            'UG CGPA': s.ug_cgpa?.toFixed(2) || 'N/A',
            'Backlogs': s.backlogs,
            'Performance Status': s.performance_status,
            'Risk Level': s.detention_risk,
            'Applications': s.application_count,
            'Offers': s.offers_count,
            'XP Points': s.xp,
            'Batch': s.ug_passout_year
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Performance_${viewMode}`);
        XLSX.writeFile(wb, `Student_Performance_${user.college}_${viewMode}.xlsx`);
        toast.success("Export successful!");
    };

    const handleRowClick = (student: StudentPerformanceData) => {
        setSelectedStudent(student);
        setIsModalOpen(true);
    };

    const getPerformanceColor = (perf: StudentPerformanceData['performance_status']) => {
        switch (perf) {
            case 'High': return 'text-green-400 font-bold';
            case 'Moderate': return 'text-blue-300';
            case 'Low': return 'text-yellow-400';
            case 'Poor': return 'text-red-400 font-bold';
        }
    };

    const currentYear = new Date().getFullYear();
    const passoutYears = Array.from({ length: 10 }, (_, i) => (currentYear + 5 - i).toString());

    return (
        <div>
            <header className="mb-8 text-left">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Student Intelligence
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    Comprehensive performance tracking, risk assessment, and identity management.
                </p>
            </header>

            <Card glow="none" className="mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                        {isUniversityLevelAdmin && (
                            <div>
                                <label className="block text-primary font-display text-lg mb-2">Department</label>
                                {isLoadingDepartments ? (
                                    <div className="flex items-center p-3"><Spinner /><span className="ml-2 text-text-muted">Loading...</span></div>
                                ) : (
                                    <select
                                        value={filterDepartment}
                                        onChange={(e) => setFilterDepartment(e.target.value)}
                                        className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-lg text-text-base"
                                    >
                                        <option value="all">All Departments</option>
                                        {departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}
                                    </select>
                                )}
                            </div>
                        )}
                        <div>
                            <label className="block text-primary font-display text-lg mb-2">Passout Year</label>
                            <select
                                value={filterPassoutYear}
                                onChange={(e) => setFilterPassoutYear(e.target.value)}
                                className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-lg text-text-base"
                            >
                                <option value="all">All Years</option>
                                {passoutYears.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <div className="flex bg-card-bg/50 p-1 rounded-lg border border-primary/20">
                    <button onClick={() => setViewMode('academic')} className={`px-6 py-2 rounded-md text-sm font-display uppercase tracking-wider font-semibold transition-all ${viewMode === 'academic' ? 'bg-primary text-black shadow-lg' : 'text-text-muted hover:text-white'}`}>Academic</button>
                    <button onClick={() => setViewMode('placement')} className={`px-6 py-2 rounded-md text-sm font-display uppercase tracking-wider font-semibold transition-all ${viewMode === 'placement' ? 'bg-secondary text-black shadow-lg' : 'text-text-muted hover:text-white'}`}>Placement</button>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" onClick={handleExport} disabled={isLoadingStudents || students.length === 0} className="text-xs py-1.5 px-3 flex items-center gap-2 border border-primary/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Export Data
                    </Button>
                    <Button variant="secondary" onClick={() => detentionReportMutation.mutate()} disabled={detentionReportMutation.isPending || isLoadingStudents || students.length === 0} className="text-lg">
                        {detentionReportMutation.isPending ? <Spinner /> : `Analyze ${viewMode === 'academic' ? 'Risks' : 'Trends'}`}
                    </Button>
                </div>
            </div>

            <Card glow="none">
                {isLoadingStudents ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : isError ? (
                    <p className="text-red-400 text-center p-8">Error loading students: {error?.message}</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-lg border-collapse">
                                <thead className="font-display text-secondary border-b-2 border-secondary/50">
                                    <tr>
                                        <th className="p-3">Roll Number</th>
                                        <th className="p-3">Name</th>

                                        {viewMode === 'academic' ? (
                                            <>
                                                <th className="p-3 hidden md:table-cell">Department</th>
                                                <th className="p-3 text-center">CGPA</th>
                                                <th className="p-3 text-center">Backlogs</th>
                                                <th className="p-3 text-center">Performance</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="p-3 text-center">Registered</th>
                                                <th className="p-3 text-center">Placed In</th>
                                                <th className="p-3 text-center">XP Points</th>
                                                <th className="p-3 text-center">CGPA</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.length === 0 && (
                                        <tr><td colSpan={6} className="text-center p-4 text-text-muted">No students found matching filters.</td></tr>
                                    )}
                                    {students.map(student => (
                                        <tr
                                            key={student.id}
                                            onClick={() => handleRowClick(student)}
                                            className="border-b border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
                                        >
                                            <td className="p-3 text-text-muted font-student-label uppercase">{student.roll_number}</td>
                                            <td className="p-3 font-medium">{student.name}</td>

                                            {viewMode === 'academic' ? (
                                                <>
                                                    <td className="p-3 hidden md:table-cell text-sm">{student.department}</td>
                                                    <td className="p-3 text-center font-mono">{student.ug_cgpa?.toFixed(2) || 'N/A'}</td>
                                                    <td className={`p-3 text-center font-bold ${student.backlogs > 0 ? 'text-red-400' : 'text-text-muted'}`}>{student.backlogs ?? 0}</td>
                                                    <td className={`p-3 text-center text-sm ${getPerformanceColor(student.performance_status)}`}>
                                                        {student.performance_status}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-3 text-center">
                                                        <span className="bg-primary/10 text-primary px-3 py-1 rounded font-bold">{student.application_count}</span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="text-green-400 font-bold">{student.offers_count}</span>
                                                    </td>
                                                    <td className="p-3 text-center text-secondary font-bold">
                                                        {student.xp}
                                                    </td>
                                                    <td className="p-3 text-center text-text-muted">
                                                        {student.ug_cgpa?.toFixed(2)}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </>
                )}
            </Card>

            {aiReport && !detentionReportMutation.isPending && (
                <Card glow="secondary" className="mt-8">
                    <h2 className="font-display text-2xl text-secondary mb-4">AI Strategic Analysis</h2>
                    <MarkdownRenderer content={aiReport} />
                </Card>
            )}

            {selectedStudent && (
                <PerformanceStudentDetailModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    student={selectedStudent}
                />
            )}
        </div>
    );
};

const PerformanceStudentDetailModal: React.FC<{ isOpen: boolean, onClose: () => void, student: StudentPerformanceData }> = ({ isOpen, onClose, student }) => {
    const supabase = useSupabase();
    const { data: certifications = [], isLoading: isLoadingCerts } = useQuery<StudentCertification[]>({
        queryKey: ['studentCertifications', student.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('student_certifications').select('*').eq('student_id', student.id);
            if (error) throw error;
            return data || [];
        },
        enabled: isOpen && !!student.id,
    });
    const { data: achievements = [], isLoading: isLoadingAchievements } = useQuery<StudentAchievement[]>({
        queryKey: ['studentAchievements', student.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('student_achievements').select('*').eq('student_id', student.id);
            if (error) throw error;
            return data || [];
        },
        enabled: isOpen && !!student.id,
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Student Details">
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-primary/20 pb-4">
                    <div>
                        <h2 className="text-2xl font-display text-primary flex items-center">{student.name} <CopyButton text={student.name} /></h2>
                        <p className="text-text-muted font-student-label flex items-center text-lg uppercase">{student.roll_number} <CopyButton text={student.roll_number} /></p>
                    </div>
                    <div className="text-right">
                        <span className={`px-3 py-1 rounded text-sm font-bold uppercase ${student.detention_risk === 'High Risk' ? 'bg-red-500/20 text-red-400' : student.detention_risk === 'At Risk' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                            {student.detention_risk}
                        </span>
                        <p className="text-xs text-text-muted mt-1">Risk Level</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div className="space-y-2">
                        <h3 className="font-display text-secondary border-b border-secondary/30 pb-1 mb-2">Academic Profile</h3>
                        <div className="flex justify-between"><span className="text-text-muted">Department:</span> <span>{student.department}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Section:</span> <span>{student.section || 'N/A'}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Batch:</span> <span>{student.ug_passout_year}</span></div>
                        <div className="flex justify-between items-center"><span className="text-text-muted">UG CGPA:</span> <span className="text-xl font-bold text-primary">{student.ug_cgpa?.toFixed(2)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-text-muted">Backlogs:</span> <span className={`text-xl font-bold ${student.backlogs > 0 ? 'text-red-400' : 'text-green-400'}`}>{student.backlogs}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">12th / Diploma:</span> <span>{student.inter_diploma_percentage || 'N/A'}%</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">10th:</span> <span>{student.tenth_percentage || 'N/A'}%</span></div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-display text-secondary border-b border-secondary/30 pb-1 mb-2">Placement & Activity</h3>
                        <div className="flex justify-between"><span className="text-text-muted">Performance:</span> <span className="font-bold">{student.performance_status}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Registered Apps:</span> <span>{student.application_count}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Placed In:</span> <span className="text-green-400">{student.offers_count}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">XP Points:</span> <span className="text-secondary">{student.xp}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Level:</span> <span>{student.level}</span></div>
                    </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-primary/10">
                    <h3 className="font-display text-secondary text-sm uppercase">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center overflow-hidden">
                            <span className="text-text-muted w-20 flex-shrink-0">Email:</span>
                            <span className="truncate text-text-base" title={student.email}>{student.email}</span>
                            <CopyButton text={student.email} />
                        </div>
                        <div className="flex items-center overflow-hidden">
                            <span className="text-text-muted w-20 flex-shrink-0">Mobile:</span>
                            <span className="truncate text-text-base">{student.mobile_number || 'N/A'}</span>
                            {student.mobile_number && <CopyButton text={student.mobile_number} />}
                        </div>
                        <div className="flex items-center overflow-hidden">
                            <span className="text-text-muted w-20 flex-shrink-0">Personal Email:</span>
                            <span className="truncate text-text-base">{student.personal_email || 'N/A'}</span>
                            {student.personal_email && <CopyButton text={student.personal_email} />}
                        </div>
                    </div>
                </div>

                {isLoadingCerts ? <Spinner /> : certifications.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-primary/10">
                        <h3 className="font-display text-secondary text-sm uppercase">Certifications</h3>
                        <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                            {certifications.map(cert => (
                                <div key={cert.id} className="text-sm bg-card-bg/50 p-2 rounded">
                                    <p className="font-bold">{cert.name}</p>
                                    <p className="text-xs text-text-muted">{cert.issuing_organization}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isLoadingAchievements ? <Spinner /> : achievements.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-primary/10">
                        <h3 className="font-display text-secondary text-sm uppercase">Achievements</h3>
                        <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                            {achievements.map(ach => (
                                <p key={ach.id} className="text-sm bg-card-bg/50 p-2 rounded">{ach.description}</p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};


export default StudentPerformancePage;
