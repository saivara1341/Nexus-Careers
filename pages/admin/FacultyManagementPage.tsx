


import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
// Fix: Removed direct supabase import
// import { supabase } from '../../services/supabase.ts';
import type { AdminProfile, Department, AdminRole } from '../../types.ts';
import { UNIVERSITY_LEVEL_ROLES } from '../../types.ts'; // Import UNIVERSITY_LEVEL_ROLES
import { Card } from '../../components/ui/Card.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Pagination } from '../../components/ui/Pagination.tsx';
// Fix: Added useSupabase import
import { useSupabase } from '../../contexts/SupabaseContext.tsx';


interface FacultyManagementPageProps {
    user: AdminProfile;
}

const PAGE_SIZE = 25;

// Utility to fetch departments - duplicated in relevant files to avoid new file creation for common functions
// Fix: fetchDepartments now accepts supabase client
const fetchDepartments = async (supabase, college: string): Promise<Department[]> => {
    const { data, error } = await supabase
        .from('departments')
        .select('id, name, college_name')
        .eq('college_name', college)
        .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
};

// Fix: fetchAdmins now accepts supabase client
const fetchAdmins = async (supabase, college: string, page: number, department?: string) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase.from('admins').select('id, name, email, role, department', { count: 'exact' }).eq('college', college);
    if (department) {
        query = query.eq('department', department).in('role', ['HOD', 'Faculty', 'Placement Officer']); // Filter for department-specific roles
    }
    const { data, error, count } = await query.order('name').range(from, to);

    if (error) throw error;
    return { data: (data as AdminProfile[]) || [], count: count || 0 };
};

const FacultyList: React.FC<{ faculty: AdminProfile[] }> = ({ faculty }) => (
    <div className="space-y-3">
        {faculty.length === 0 && <p className="text-text-muted">No faculty found.</p>}
        {faculty.map(person => (
            <div key={person.id} className="bg-background/50 p-3 rounded-md border border-primary/20 flex justify-between items-center">
                <div>
                    <p className="font-bold text-lg text-text-base">{person.name}</p>
                    <p className="text-sm text-text-muted">{person.email}</p>
                </div>
                <span className="text-secondary font-display">{person.role}</span>
            </div>
        ))}
    </div>
);


const FacultyManagementPage: React.FC<FacultyManagementPageProps> = ({ user }) => {
    // Fix: Get supabase client from context
    const supabase = useSupabase();
    const [page, setPage] = useState(1);
    // Fix: Add a type guard for user.role before checking against UNIVERSITY_LEVEL_ROLES
    const isUserAdminRole = (role: AdminRole | 'admin'): role is AdminRole => role !== 'admin';
    const isUniversityLevel = isUserAdminRole(user.role) && UNIVERSITY_LEVEL_ROLES.includes(user.role);
    const department = isUniversityLevel ? undefined : user.department; // Only pass department if not university-level

    // Fix: Use placeholderData instead of keepPreviousData and explicitly type useQuery's return
    const { data: adminsData, isLoading } = useQuery<{ data: AdminProfile[]; count: number }, Error>({
        queryKey: ['admins', user.college, department, page],
        queryFn: () => fetchAdmins(supabase, user.college, page, department), // Pass supabase
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new
    });
    
    const admins = adminsData?.data ?? [];
    const count = adminsData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const groupedByDept = useMemo(() => {
        if (!isUniversityLevel || isLoading) return null;
        return admins.reduce((acc, admin) => {
            const dept = admin.department || 'University Level';
            if (!acc[dept]) {
                acc[dept] = [];
            }
            acc[dept].push(admin);
            return acc;
        }, {} as Record<string, AdminProfile[]>);
    }, [admins, isLoading, isUniversityLevel]);
    
    const pageTitle = isUniversityLevel ? "All Departments & Staff" : `Faculty of ${user.department}`;

    return (
        <div>
            <h1 className="font-display text-4xl text-primary mb-6">{pageTitle}</h1>

            {isLoading && admins.length === 0 ? (
                <div className="flex justify-center p-8"><Spinner /></div>
            ) : isUniversityLevel && groupedByDept ? (
                 <>
                    <div className="space-y-6">
                        {Object.entries(groupedByDept).sort(([deptA], [deptB]) => deptA.localeCompare(deptB)).map(([deptName, faculty]) => (
                            <Card key={deptName} glow="secondary">
                                <h2 className="font-display text-2xl text-secondary mb-4">{deptName}</h2>
                                <FacultyList faculty={faculty} />
                            </Card>
                        ))}
                    </div>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                 </>
            ) : (
                <Card glow="primary">
                    <FacultyList faculty={admins} />
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                </Card>
            )}
        </div>
    );
};

export default FacultyManagementPage;