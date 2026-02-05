

import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminProfile, Department, AdminRole } from '../../types.ts';
import { UNIVERSITY_LEVEL_ROLES } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Pagination } from '../../components/ui/Pagination.tsx';
import toast from 'react-hot-toast';

interface DepartmentManagementPageProps {
    user: AdminProfile;
}

const PAGE_SIZE = 10;

const fetchDepartments = async (supabase: any, college: string, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
        .from('departments')
        .select('*', { count: 'exact' })
        .eq('college_name', college)
        .order('name', { ascending: true })
        .range(from, to);
    if (error) throw error;
    return { data: data as Department[], count: count || 0 };
};

const addDepartment = async (supabase: any, { name, college_name }: { name: string, college_name: string }) => {
    const { error } = await supabase.from('departments').insert({ name, college_name });
    if (error) throw error;
};

const deleteDepartment = async (supabase: any, id: string) => {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw error;
};

const DepartmentManagementPage: React.FC<DepartmentManagementPageProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const isUserAdminRole = (role: AdminRole | 'admin'): role is AdminRole => role !== 'admin';
    const isUniversityLevelAdmin = isUserAdminRole(user.role) && UNIVERSITY_LEVEL_ROLES.includes(user.role);

    const { data: departmentsData, isLoading, isError, error } = useQuery<{ data: Department[]; count: number }, Error>({
        queryKey: ['departments', user.college, page],
        queryFn: () => fetchDepartments(supabase, user.college, page),
        enabled: isUniversityLevelAdmin,
        placeholderData: (previousData) => previousData,
    });

    const departments = departmentsData?.data ?? [];
    const count = departmentsData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const addDepartmentMutation = useMutation({
        mutationFn: (vars: { name: string, college_name: string }) => addDepartment(supabase, vars),
        onSuccess: () => {
            toast.success('Department added successfully!');
            queryClient.invalidateQueries({ queryKey: ['departments', user.college] });
            setIsAddModalOpen(false);
        },
        onError: (err: any) => {
            if (err.code === '23505') {
                toast.error('A department with this name already exists.');
            } else {
                toast.error(`Error adding department: ${err.message}`);
            }
        },
    });

    const deleteDepartmentMutation = useMutation({
        mutationFn: (id: string) => deleteDepartment(supabase, id),
        onSuccess: () => {
            toast.success('Department deleted successfully!');
            queryClient.invalidateQueries({ queryKey: ['departments', user.college] });
        },
        onError: (err: any) => {
            if (err.code === '23503') {
                toast.error('Cannot delete: Department has associated records (students, etc.).');
            } else {
                toast.error(`Error deleting department: ${err.message}`);
            }
        },
    });

    if (!isUniversityLevelAdmin) {
        return (
            <Card glow="none" className="text-center p-8">
                <h1 className="font-display text-3xl md:text-4xl text-primary mb-4">Permission Denied</h1>
                <p className="text-lg text-text-muted">You do not have the necessary permissions to manage departments. This feature is restricted to University-level administrators.</p>
            </Card>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <h1 className="font-display text-4xl text-primary">Department Management</h1>
                <Button variant="primary" onClick={() => setIsAddModalOpen(true)} className="text-lg">+ Add Department</Button>
            </div>
            
            <Card glow="none">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : isError ? (
                    <p className="text-red-400 text-center p-8">Error loading departments: {error?.message}</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-lg">
                                <thead className="font-display text-secondary border-b-2 border-secondary/50">
                                    <tr>
                                        <th className="p-3">Department Name</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departments.length === 0 && (
                                        <tr><td colSpan={2} className="text-center p-4 text-text-muted">No departments found for {user.college}.</td></tr>
                                    )}
                                    {departments.map(dept => (
                                        <tr key={dept.id} className="border-b border-primary/20 hover:bg-primary/10">
                                            <td className="p-3">{dept.name}</td>
                                            <td className="p-3 text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    className="text-sm py-1 px-2 !border-red-400 !text-red-400 hover:!bg-red-500 hover:!text-white" 
                                                    onClick={() => {
                                                        if (window.confirm(`Delete ${dept.name}?`)) {
                                                            deleteDepartmentMutation.mutate(dept.id);
                                                        }
                                                    }}
                                                    disabled={deleteDepartmentMutation.isPending}
                                                >
                                                    Delete
                                                </Button>
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

            <AddDepartmentModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                userCollege={user.college} 
                addDepartmentMutation={addDepartmentMutation}
            />
        </div>
    );
};

interface AddDepartmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    userCollege: string;
    addDepartmentMutation: ReturnType<typeof useMutation<any, Error, { name: string, college_name: string }>>;
}

const AddDepartmentModal: React.FC<AddDepartmentModalProps> = ({ isOpen, onClose, userCollege, addDepartmentMutation }) => {
    const [departmentName, setDepartmentName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!departmentName.trim()) {
            toast.error('Department name cannot be empty.');
            return;
        }
        addDepartmentMutation.mutate({ name: departmentName.trim(), college_name: userCollege });
    };

    useEffect(() => {
        if (!isOpen) {
            setDepartmentName('');
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Department">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input 
                    label="Department Name" 
                    placeholder="e.g., Computer Science and Engineering" 
                    value={departmentName} 
                    onChange={e => setDepartmentName(e.target.value)} 
                    required 
                />
                <Button type="submit" className="w-full text-lg" disabled={addDepartmentMutation.isPending}>
                    {addDepartmentMutation.isPending ? <Spinner /> : 'Add Department'}
                </Button>
            </form>
        </Modal>
    );
};

export default DepartmentManagementPage;
