
import React, { useState, useEffect, useMemo } from 'react';
import type { StudentProfile, AdminProfile, Department } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pagination } from '../../components/ui/Pagination.tsx';
import toast from 'react-hot-toast';
import { GENDERS } from '../../types.ts';
import { COMMON_DEPARTMENTS } from '../AuthPage.tsx';
import * as XLSX from 'xlsx';
import { logAdminAction } from '../../utils/adminLogger.ts';

interface StudentsHubProps {
    user: AdminProfile;
}

// Sorting Types
type SortField = 'name' | 'roll_number' | 'department' | 'ug_cgpa' | 'backlogs';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
    field: SortField;
    direction: SortDirection;
}

interface FilterConfig {
    department: string;
    year: string;
    status: 'All' | 'Active Backlogs' | 'High Achievers' | 'At Risk' | 'Predictive At-Risk';
}

const PAGE_SIZE = 15;

const fetchUnifiedStudents = async (supabase: any, user: AdminProfile, page: number, searchTerm: string, sort: SortConfig, filters: FilterConfig) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
        .from('student_registry')
        .select('*', { count: 'exact' })
        .eq('college', user.college);

    if (user.department) {
        query = query.eq('department', user.department);
    } else if (filters.department !== 'All') {
        query = query.eq('department', filters.department);
    }

    if (filters.year !== 'All') {
        query = query.eq('ug_passout_year', parseInt(filters.year));
    }

    if (filters.status === 'Active Backlogs') {
        query = query.gt('backlogs', 0);
    } else if (filters.status === 'High Achievers') {
        query = query.gte('ug_cgpa', 8.5);
    } else if (filters.status === 'At Risk') {
        query = query.or('ug_cgpa.lt.5.0,backlogs.gt.2');
    }
    // Note: 'Predictive At-Risk' is handled on the mapping side since it requires application counts

    if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,roll_number.ilike.%${searchTerm}%`);
    }

    // Sort logic - prioritize roll_number if field is roll_number
    query = query.order(sort.field, { ascending: sort.direction === 'asc' });

    const { data: registryData, error: registryError, count } = await query.range(from, to);
    if (registryError) throw registryError;

    if (!registryData || registryData.length === 0) {
        return { data: [], count: 0 };
    }

    const emails = registryData.map((r: any) => r.email).filter(Boolean);
    let activeMap = new Set<string>();
    let applicationCountMap = new Map<string, number>();

    if (emails.length > 0) {
        const { data: activeStudents, error: activeError } = await supabase
            .from('students')
            .select('id, email')
            .in('email', emails);

        if (!activeError && activeStudents) {
            activeStudents.forEach((s: any) => activeMap.add(s.email));

            // Fetch application counts for these students
            const studentIds = activeStudents.map((s: any) => s.id);
            const { data: appsData } = await supabase
                .from('applications')
                .select('student_id')
                .in('student_id', studentIds);

            if (appsData) {
                const counts = appsData.reduce((acc: any, curr: any) => {
                    acc[curr.student_id] = (acc[curr.student_id] || 0) + 1;
                    return acc;
                }, {});

                activeStudents.forEach((s: any) => {
                    applicationCountMap.set(s.email, counts[s.id] || 0);
                });
            }
        }
    }

    let mappedData = registryData.map((r: any) => {
        const isActive = activeMap.has(r.email);
        const appCount = applicationCountMap.get(r.email) || 0;

        // Predictive At-Risk logic: Active student + Eligible CGPA (e.g. > 6) + 0 applications
        const isPredictiveAtRisk = isActive && (r.ug_cgpa >= 6.0) && appCount === 0;

        return {
            ...r,
            id: r.id,
            status: isActive ? 'Active' : 'Pending Signup',
            application_count: appCount,
            isPredictiveAtRisk,
            is_whitelisted: r.is_whitelisted
        };
    });

    if (filters.status === 'Predictive At-Risk') {
        mappedData = mappedData.filter(student => student.isPredictiveAtRisk);
    }

    return { data: mappedData, count: count || 0 };
};

const updateStudentRegistry = async (supabase: any, registryId: string, updates: Partial<StudentProfile>, modifier: { id: string, name: string }) => {
    const payload = {
        ...updates,
        last_modified_by_id: modifier.id,
        last_modified_by_name: modifier.name,
        last_modified_at: new Date().toISOString()
    };
    const { error } = await supabase.from('student_registry').update(payload).eq('id', registryId);
    if (error) throw error;
};

const addStudentToRegistry = async (supabase: any, studentData: any) => {
    const { data: existing, error: checkError } = await supabase
        .from('student_registry')
        .select('id')
        .or(`email.eq.${studentData.email},roll_number.eq.${studentData.roll_number}`)
        .eq('college', studentData.college);

    if (checkError) throw checkError;
    if (existing && existing.length > 0) throw new Error("Student with this Email or Roll Number already exists.");

    const { error } = await supabase.from('student_registry').insert(studentData);
    if (error) throw error;
};

const fetchDepartments = async (supabase: any, college: string) => {
    const { data } = await supabase.from('departments').select('name').eq('college_name', college).order('name');
    return data || [];
};

// Copy Helper
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast.success('Copied!', { icon: '📋', duration: 1500, style: { fontSize: '12px', padding: '8px' } });
    };
    return (
        <button onClick={handleCopy} className="ml-2 text-text-muted hover:text-primary transition-all active:scale-95 inline-flex items-center justify-center p-1 rounded-md hover:bg-primary/10" title="Copy">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
    );
};

const StudentsHub: React.FC<StudentsHubProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

    // FIX: Default to roll_number sorting as requested by user
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'roll_number', direction: 'asc' });
    const [filterConfig, setFilterConfig] = useState<FilterConfig>({ department: 'All', year: 'All', status: 'All' });

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
    const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const { data: departments = [] } = useQuery({
        queryKey: ['depts', user.college],
        queryFn: () => fetchDepartments(supabase, user.college)
    });

    const { data: studentsData, isLoading } = useQuery({
        queryKey: ['unified_students', user.college, user.department, page, debouncedSearchTerm, sortConfig, filterConfig],
        queryFn: () => fetchUnifiedStudents(supabase, user, page, debouncedSearchTerm, sortConfig, filterConfig),
        placeholderData: (prev) => prev,
    });

    const students = studentsData?.data ?? [];
    const count = studentsData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const handleSort = (field: SortField) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const updateMutation = useMutation({
        mutationFn: (updates: Partial<StudentProfile>) => updateStudentRegistry(supabase, selectedStudent!.id, updates, { id: user.id, name: user.name }),
        onSuccess: () => {
            toast.success("Student registry updated successfully");
            queryClient.invalidateQueries({ queryKey: ['unified_students'] });
            setIsEditMode(false);
            setIsAddModalOpen(false);
        },
        onError: (error: any) => toast.error(error.message)
    });

    const addMutation = useMutation({
        mutationFn: (newStudent: any) => addStudentToRegistry(supabase, newStudent),
        onSuccess: () => {
            toast.success("Student added to Registry!");
            queryClient.invalidateQueries({ queryKey: ['unified_students'] });
            setIsAddModalOpen(false);
        },
        onError: (error: any) => toast.error(error.message)
    });

    const handleRowClick = (student: any) => {
        setSelectedStudent(student);
        setIsEditMode(false);
        setIsAddModalOpen(true); // Using AddModal for details/edit as per existing pattern
    };

    useEffect(() => { setPage(1); }, [debouncedSearchTerm, sortConfig, filterConfig]);

    const getStatusColor = (status: string) => {
        return status === 'Active' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    };

    const getSortIcon = (field: SortField) => {
        if (sortConfig.field !== field) return <span className="text-gray-600 ml-1 opacity-30">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-primary ml-1">↑</span> : <span className="text-primary ml-1">↓</span>;
    };

    const currentYear = new Date().getFullYear();
    const passoutYears = Array.from({ length: 7 }, (_, i) => (currentYear + 3 - i).toString());

    return (
        <div className="p-2 md:p-0">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Students Hub
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            {user.department || 'Institutional'} registry and enrollment monitoring system.
                        </p>
                    </div>
                    <div className="flex gap-2 bg-card-bg/50 p-1 rounded-lg border border-secondary/20 shrink-0">
                        <Button variant="secondary" onClick={() => setIsChoiceModalOpen(true)} className="text-xs py-2 px-4 shadow-lg">
                            + Add Student
                        </Button>
                    </div>
                </div>
            </header>

            <Card glow="none" className="border-primary/20 overflow-hidden bg-card-bg/30 backdrop-blur-md">
                {/* Filter & Search Bar */}
                <div className="flex flex-col xl:flex-row gap-4 mb-6">
                    <div className="relative flex-grow max-w-md">
                        <Input
                            placeholder="Search Name or Roll No..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto overflow-x-auto">
                        {!user.department && (
                            <select
                                className="bg-input-bg border-2 border-primary/50 rounded-md p-3 text-text-base min-w-[150px]"
                                value={filterConfig.department}
                                onChange={(e) => setFilterConfig(prev => ({ ...prev, department: e.target.value }))}
                            >
                                <option value="All">All Departments</option>
                                {departments.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                        )}

                        <select
                            className="bg-input-bg border-2 border-primary/50 rounded-md p-3 text-text-base min-w-[120px]"
                            value={filterConfig.year}
                            onChange={(e) => setFilterConfig(prev => ({ ...prev, year: e.target.value }))}
                        >
                            <option value="All">All Batches</option>
                            {passoutYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>

                        <select
                            className="bg-input-bg border-2 border-primary/50 rounded-md p-3 text-text-base min-w-[150px]"
                            value={filterConfig.status}
                            onChange={(e) => setFilterConfig(prev => ({ ...prev, status: e.target.value as any }))}
                        >
                            <option value="All">All Statuses</option>
                            <option value="High Achievers">High Achievers (8.5+)</option>
                            <option value="Active Backlogs">Active Backlogs</option>
                            <option value="At Risk">At Risk (CGPA &lt; 5)</option>
                            <option value="Predictive At-Risk">Predictive At-Risk (0 Apps)</option>
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center p-12"><Spinner /></div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {students.length === 0 && <p className="text-center text-text-muted p-4">No students found.</p>}
                        {students.map((student: any) => (
                            <div key={student.roll_number} onClick={() => handleRowClick(student)} className="bg-card-bg p-4 rounded-lg border border-primary/20 active:scale-95 transition-transform cursor-pointer">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-primary text-lg">{student.name}</h3>
                                            {student.is_whitelisted && <span className="material-symbols-outlined text-secondary text-sm" title="Whitelisted">verified</span>}
                                        </div>
                                        <p className="text-sm text-text-muted uppercase">{student.roll_number}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded whitespace-nowrap inline-block font-bold ${getStatusColor(student.status)}`}>{student.status}</span>
                                </div>
                                <div className="text-sm text-text-base mb-1 truncate">{student.department}</div>
                                <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                                    <span className="text-xs text-secondary font-bold">CGPA: {student.ug_cgpa?.toFixed(2) || '-'}</span>
                                    <div className="flex items-center gap-2">
                                        {student.isPredictiveAtRisk && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/50 animate-pulse font-bold">PREDICTIVE ALERT</span>}
                                        <span className={`text-xs font-bold ${student.backlogs > 0 ? 'text-red-400' : 'text-green-400'}`}>Backlogs: {student.backlogs || 0}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isLoading && (
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-primary/5 text-xs font-display uppercase text-text-muted tracking-wider border-b border-primary/20">
                                <tr>
                                    <th className="p-3 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => handleSort('roll_number')}>
                                        Roll No {getSortIcon('roll_number')}
                                    </th>
                                    <th className="p-3 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => handleSort('name')}>
                                        Name {getSortIcon('name')}
                                    </th>
                                    <th className="p-3 cursor-pointer hover:text-primary transition-colors select-none" onClick={() => handleSort('department')}>
                                        Department {getSortIcon('department')}
                                    </th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-center cursor-pointer hover:text-primary transition-colors select-none" onClick={() => handleSort('ug_cgpa')}>
                                        CGPA {getSortIcon('ug_cgpa')}
                                    </th>
                                    <th className="p-3 text-center cursor-pointer hover:text-primary transition-colors select-none" onClick={() => handleSort('backlogs')}>
                                        Backlogs {getSortIcon('backlogs')}
                                    </th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-primary/10">
                                {students.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-text-muted">No students found matching criteria.</td></tr>}
                                {students.map((student: any) => (
                                    <tr key={student.roll_number} onClick={() => handleRowClick(student)} className="hover:bg-primary/5 cursor-pointer transition-colors group">
                                        <td className="p-3 text-sm font-student-label tracking-wider text-text-muted group-hover:text-text-base uppercase">{student.roll_number}</td>
                                        <td className="p-3 font-medium text-text-base group-hover:text-primary transition-colors flex items-center gap-2">
                                            {student.name}
                                            {student.is_whitelisted && <span className="material-symbols-outlined text-secondary text-xs" title="Whitelisted">verified</span>}
                                        </td>
                                        <td className="p-3 text-sm">{student.department}</td>
                                        <td className="p-3 text-center">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border inline-block whitespace-nowrap ${getStatusColor(student.status)}`}>
                                                {student.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center font-student-body font-bold text-secondary">{student.ug_cgpa?.toFixed(2) || '-'}</td>
                                        <td className="p-3 text-center">
                                            {student.backlogs > 0 ? <span className="text-red-400 font-bold">{student.backlogs}</span> : <span className="text-text-muted">-</span>}
                                            {student.isPredictiveAtRisk && (
                                                <div className="text-[8px] text-red-400 font-bold mt-1 animate-pulse">0 APPLICATIONS</div>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <Button variant="ghost" className="text-xs py-1 px-3 opacity-70 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleRowClick(student); }}>View</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </Card>

            {selectedStudent && (
                <StudentDetailModal
                    isOpen={isAddModalOpen && selectedStudent} // Only show detail if selected
                    onClose={() => { setIsAddModalOpen(false); setSelectedStudent(null); }}
                    student={selectedStudent}
                    isEditMode={isEditMode}
                    setEditMode={setIsEditMode}
                    onSave={(data) => updateMutation.mutate(data)}
                    isSaving={updateMutation.isPending}
                    college={user.college}
                />
            )}

            <AddStudentModal
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setSelectedStudent(null); }}
                onSave={(data) => addMutation.mutate({ ...data, college: user.college })}
                isSaving={addMutation.isPending}
                college={user.college}
                userDept={user.department}
            />

            {/* Choice Modal */}
            <Modal isOpen={isChoiceModalOpen} onClose={() => setIsChoiceModalOpen(false)} title="Add Students">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                    <button
                        onClick={() => { setIsChoiceModalOpen(false); setIsAddModalOpen(true); }}
                        className="flex flex-col items-center justify-center p-6 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors group"
                    >
                        <span className="material-symbols-outlined text-4xl text-primary mb-2 group-hover:scale-110 transition-transform">person_add</span>
                        <span className="font-bold text-text-base">Single Student</span>
                        <span className="text-[10px] text-text-muted mt-1 uppercase">Manual Entry</span>
                    </button>
                    <button
                        onClick={() => { setIsChoiceModalOpen(false); setIsBulkModalOpen(true); }}
                        className="flex flex-col items-center justify-center p-6 bg-secondary/5 border border-secondary/20 rounded-xl hover:bg-secondary/10 transition-colors group"
                    >
                        <span className="material-symbols-outlined text-4xl text-secondary mb-2 group-hover:scale-110 transition-transform">upload_file</span>
                        <span className="font-bold text-text-base">Multiple Students</span>
                        <span className="text-[10px] text-text-muted mt-1 uppercase">Bulk Excel Upload</span>
                    </button>
                </div>
            </Modal>

            <BulkImportModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                user={user}
            />
        </div>
    );
};

const StudentDetailModal: React.FC<any> = ({ isOpen, onClose, student, isEditMode, setEditMode, onSave, isSaving, college }) => {
    const supabase = useSupabase();
    const [formData, setFormData] = useState<Partial<StudentProfile>>(student);
    const { data: departments = [] } = useQuery({ queryKey: ['depts', college], queryFn: () => fetchDepartments(supabase, college) });

    useEffect(() => { setFormData(student); }, [student, isEditMode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const { data: changeHistory = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ['student_audit', student?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('admin_logs')
                .select('*')
                .eq('entity_type', 'student_registry')
                .eq('entity_id', student?.id)
                .order('created_at', { ascending: false });
            return data || [];
        },
        enabled: !!student?.id && isOpen
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...formData };
        if (payload.ug_cgpa) payload.ug_cgpa = parseFloat(payload.ug_cgpa as any);
        if (payload.backlogs) payload.backlogs = parseInt(payload.backlogs as any);
        onSave(payload);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Edit Registry" : "Student Details"}>
            {isEditMode ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Name" name="name" value={formData.name} onChange={handleChange} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="CGPA" name="ug_cgpa" type="number" step="0.01" value={formData.ug_cgpa} onChange={handleChange} />
                        <Input label="Backlogs" name="backlogs" type="number" value={formData.backlogs} onChange={handleChange} />
                    </div>
                    <Input label="Passout Year" name="ug_passout_year" type="number" value={formData.ug_passout_year} onChange={handleChange} />
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setEditMode(false)} className="flex-1">Cancel</Button>
                        <Button type="submit" disabled={isSaving} className="flex-1">{isSaving ? <Spinner /> : 'Save'}</Button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-primary/20 pb-4">
                        <div>
                            <h2 className="text-2xl font-display text-primary">{student.name} <CopyButton text={student.name} /></h2>
                            <p className="text-text-muted font-student-label flex items-center uppercase">{student.roll_number} <CopyButton text={student.roll_number} /></p>
                        </div>
                        <Button variant="secondary" className="text-xs" onClick={() => setEditMode(true)}>Edit</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-6 text-sm">
                        <div><span className="text-text-muted block mb-1">Department</span> <span className="text-lg">{student.department}</span></div>
                        <div><span className="text-text-muted block mb-1">Batch</span> <span className="text-lg">{student.ug_passout_year || 'N/A'}</span></div>
                        <div><span className="text-text-muted block mb-1">CGPA</span> <span className="text-lg font-bold text-secondary">{student.ug_cgpa}</span></div>
                        <div><span className="text-text-muted block mb-1">Backlogs</span> <span className={`text-lg font-bold ${student.backlogs > 0 ? 'text-red-400' : 'text-green-400'}`}>{student.backlogs}</span></div>
                        <div className="col-span-2 flex items-center">
                            <span className="text-text-muted block mr-2">Email:</span>
                            <span className="text-text-base break-all">{student.email}</span>
                            <CopyButton text={student.email} />
                        </div>
                        <div><span className="text-text-muted block mb-1">Status</span> <span className="text-text-base uppercase">{student.status}</span></div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/10">
                        <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">history_edu</span>
                            Modification Audit Trail
                        </h3>
                        <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {isLoadingHistory ? <Spinner className="w-4 h-4" /> : changeHistory.length === 0 ? (
                                <p className="text-[10px] text-text-muted italic">No modification history found.</p>
                            ) : (
                                changeHistory.map((log: any) => (
                                    <div key={log.id} className="p-2 bg-white/5 rounded border border-white/5 flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-bold text-text-base">
                                                {log.action} by <span className="text-secondary">{log.admin_name}</span>
                                            </p>
                                            <p className="text-[9px] text-text-muted">{new Date(log.created_at).toLocaleString()}</p>
                                        </div>
                                        {log.details && (
                                            <span className="text-[8px] bg-primary/10 text-primary px-1 rounded border border-primary/20 uppercase font-bold">Details Logged</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

const AddStudentModal: React.FC<any> = ({ isOpen, onClose, onSave, isSaving, college, userDept }) => {
    const supabase = useSupabase();
    const [formData, setFormData] = useState({ name: '', roll_number: '', email: '', department: userDept || '', ug_cgpa: '', backlogs: '0', ug_passout_year: '' });
    const { data: departments = [] } = useQuery({ queryKey: ['depts', college], queryFn: () => fetchDepartments(supabase, college) });
    const displayDepartments = departments.length > 0 ? departments : COMMON_DEPARTMENTS.map(d => ({ name: d }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            ...formData,
            ug_cgpa: parseFloat(formData.ug_cgpa),
            backlogs: parseInt(formData.backlogs),
            ug_passout_year: parseInt(formData.ug_passout_year)
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Student">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                <Input label="Roll No" value={formData.roll_number} onChange={e => setFormData({ ...formData, roll_number: e.target.value })} required className="uppercase" />
                <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} className="w-full bg-input-bg border border-primary/50 rounded p-3" required>
                    <option value="">Select Dept</option>
                    {displayDepartments.map((d: any) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <div className="grid grid-cols-3 gap-4">
                    <Input label="CGPA" type="number" step="0.01" value={formData.ug_cgpa} onChange={e => setFormData({ ...formData, ug_cgpa: e.target.value })} />
                    <Input label="Backlogs" type="number" value={formData.backlogs} onChange={e => setFormData({ ...formData, backlogs: e.target.value })} />
                    <Input label="Year" type="number" placeholder="YYYY" value={formData.ug_passout_year} onChange={e => setFormData({ ...formData, ug_passout_year: e.target.value })} />
                </div>
                <Button type="submit" disabled={isSaving} className="w-full">{isSaving ? <Spinner /> : 'Add'}</Button>
            </form>
        </Modal>
    );
};

export default StudentsHub;

const BulkImportModal: React.FC<any> = ({ isOpen, onClose, user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [file, setFile] = useState<File | null>(null);
    const [rawStagedStudents, setRawStagedStudents] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [shouldBulkWhitelist, setShouldBulkWhitelist] = useState(false);

    const parseFile = async (selectedFile: File) => {
        setIsProcessing(true);
        try {
            const data = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
            if (jsonData.length < 2) throw new Error("Empty file.");

            const headers = (jsonData[0] as string[]).map(h => h ? h.toString().toLowerCase().replace(/[^a-z0-9]/g, '') : '');
            const findCol = (possibleNames: string[]) => {
                const normalizedPossibles = possibleNames.map(n => n.toLowerCase().replace(/[^a-z0-9]/g, ''));
                const idx = headers.findIndex(h => normalizedPossibles.includes(h));
                return idx !== -1 ? idx : -1;
            };

            const colMap = {
                name: findCol(['name', 'studentname', 'fullname']),
                roll: findCol(['rollnumber', 'rollno', 'htno', 'roll']),
                email: findCol(['email', 'emailaddress', 'emailid']),
                dept: findCol(['department', 'dept', 'branch']),
                cgpa: findCol(['cgpa', 'ugcgpa']),
                backlogs: findCol(['backlogs', 'activebacklogs']),
                passout: findCol(['passoutyear', 'ugpassoutyear', 'year'])
            };

            if (colMap.name === -1 || colMap.roll === -1 || colMap.email === -1) {
                throw new Error("Missing required columns: Name, Roll No, or Email.");
            }

            const staged = jsonData.slice(1).map((row: any) => {
                const name = row[colMap.name];
                const roll = row[colMap.roll]?.toString().trim();
                const email = row[colMap.email]?.toString().trim();
                if (!name || !roll || !email) return null;

                // Force department if HOD
                const dept = user.role === 'HOD' ? user.department : (row[colMap.dept] || 'General');

                return {
                    name, roll_number: roll, email, college: user.college, department: dept,
                    ug_cgpa: parseFloat(row[colMap.cgpa]) || 0,
                    backlogs: parseInt(row[colMap.backlogs]) || 0,
                    ug_passout_year: parseInt(row[colMap.passout]) || new Date().getFullYear(),
                    is_whitelisted: shouldBulkWhitelist,
                    last_modified_by_id: user.id,
                    last_modified_by_name: user.name,
                    last_modified_at: new Date().toISOString()
                };
            }).filter(Boolean);
            setRawStagedStudents(staged);
        } catch (e: any) { toast.error(e.message); } finally { setIsProcessing(false); }
    };

    const importMutation = useMutation({
        mutationFn: async () => {
            const BATCH_SIZE = 50;
            for (let i = 0; i < rawStagedStudents.length; i += BATCH_SIZE) {
                const chunk = rawStagedStudents.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from('student_registry').upsert(chunk, { onConflict: 'email' });
                if (error) throw error;
                setUploadProgress(Math.round(((i + chunk.length) / rawStagedStudents.length) * 100));
            }

            logAdminAction(supabase, {
                admin_id: user.id, admin_name: user.name, action: 'UPDATE',
                entity_type: 'student_registry', entity_id: 'bulk_upload',
                details: { count: rawStagedStudents.length, type: 'bulk_import_upsert', dept: user.department || 'All' }
            });
        },
        onSuccess: () => {
            toast.success("Bulk import successful!");
            queryClient.invalidateQueries({ queryKey: ['unified_students'] });
            onClose();
            setRawStagedStudents([]);
        },
        onError: (e: any) => toast.error(e.message)
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Student Upload">
            {!rawStagedStudents.length ? (
                <div className="p-4 space-y-4">
                    <p className="text-xs text-text-muted">Upload an Excel or CSV file containing student name, roll number, and email. {user.role === 'HOD' ? `Students will be automatically assigned to ${user.department}.` : ''}</p>
                    <input type="file" accept=".xlsx,.csv" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { setFile(f); parseFile(f); }
                    }} className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary/20 file:text-primary hover:file:bg-primary/30" />
                    {isProcessing && <Spinner />}
                </div>
            ) : (
                <div className="p-4 space-y-4">
                    <div className="p-3 bg-primary/5 rounded border border-primary/20">
                        <p className="text-sm font-bold text-primary">Found {rawStagedStudents.length} Students</p>
                        <p className="text-[10px] text-text-muted uppercase">Ready for institutional registration</p>
                    </div>
                    <div className="flex items-center gap-3 bg-secondary/10 p-3 rounded-lg border border-secondary/20">
                        <input type="checkbox" checked={shouldBulkWhitelist} onChange={(e) => setShouldBulkWhitelist(e.target.checked)} id="bulk_white" className="w-4 h-4 rounded border-secondary/50 bg-input-bg text-secondary focus:ring-secondary" />
                        <label htmlFor="bulk_white" className="text-xs font-bold text-secondary cursor-pointer">Verify & Whitelist all students</label>
                    </div>
                    {importMutation.isPending && (
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                    )}
                    <div className="flex gap-2 pt-2">
                        <Button variant="ghost" className="flex-1" onClick={() => setRawStagedStudents([])}>Back</Button>
                        <Button className="flex-[2]" onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
                            {importMutation.isPending ? `Importing... ${uploadProgress}%` : 'Confirm Import'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
