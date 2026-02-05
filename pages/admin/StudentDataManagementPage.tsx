
import React, { useState, useEffect } from 'react';
import type { AdminProfile, StagedStudent, Department } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx'; // Correct import for XLSX
import { COMMON_DEPARTMENTS } from '../AuthPage.tsx';
import { logAdminAction } from '../../utils/adminLogger.ts';

// Helpers
const safeParseFloat = (val: any) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};
const safeParseInt = (val: any) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
};

const fetchDepartments = async (supabase: any, college: string) => {
    const { data } = await supabase.from('departments').select('name').eq('college_name', college);
    return data || [];
};

const StudentDataManagementPage: React.FC<{ user: AdminProfile }> = ({ user }) => {
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const supabase = useSupabase();
    const [isExporting, setIsExporting] = useState(false);

    const handleExportRegistry = async () => {
        setIsExporting(true);
        try {
            const { data: students, error } = await supabase
                .from('student_registry')
                .select('*')
                .eq('college', user.college)
                .order('roll_number', { ascending: true });

            if (error) throw error;
            if (!students || students.length === 0) {
                toast.error("No student data found to export.");
                return;
            }
            const exportData = students.map(s => ({
                'Name': s.name, 'Roll Number': s.roll_number, 'Email': s.email, 'Department': s.department,
                'UG CGPA': s.ug_cgpa, 'Backlogs': s.backlogs, 'Passout Year': s.ug_passout_year,
                'Mobile': s.mobile_number, 'Personal Email': s.personal_email, 'Gender': s.gender
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Student Registry");
            XLSX.writeFile(wb, `Student_Registry_${user.college}.xlsx`);
            toast.success("Export successful!");
        } catch (error: any) {
            toast.error("Export failed: " + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="p-2 md:p-4">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Student Registry
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            Institutional data custody, manual enrollment, and bulk migration tools.
                        </p>
                    </div>
                    <div className="flex gap-2 bg-card-bg/50 p-1 rounded-lg border border-primary/20 shrink-0">
                        <Button variant="ghost" onClick={handleExportRegistry} disabled={isExporting} className="flex items-center gap-2 text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all border-none">
                            {isExporting ? <Spinner /> : 'Export Registry'}
                        </Button>
                    </div>
                </div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card glow="primary">
                    <h2 className="font-display text-2xl text-primary mb-2">Manual Entry</h2>
                    <p className="text-text-muted mb-6">Add a single student for corrections or late admissions.</p>
                    <Button variant="primary" className="w-full text-lg" onClick={() => setIsManualModalOpen(true)}>Add Student</Button>
                </Card>
                <Card glow="secondary">
                    <h2 className="font-display text-2xl text-secondary mb-2">Bulk Upload</h2>
                    <p className="text-text-muted mb-6">Upload Excel/CSV. Automatically updates existing students.</p>
                    <Button variant="secondary" className="w-full text-lg" onClick={() => setIsBulkModalOpen(true)}>Upload File</Button>
                </Card>
            </div>

            <ManualEntryModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} user={user} />
            <BulkUploadModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} user={user} />
        </div>
    );
};

const ManualEntryModal: React.FC<{ isOpen: boolean; onClose: () => void; user: AdminProfile }> = ({ isOpen, onClose, user }) => {
    const supabase = useSupabase();
    const [formData, setFormData] = useState<any>({});
    const { data: depts = [] } = useQuery({ queryKey: ['departments', user.college], queryFn: () => fetchDepartments(supabase, user.college) });
    const displayDepts = depts.length > 0 ? depts : COMMON_DEPARTMENTS.map(d => ({ name: d }));

    useEffect(() => { if (isOpen) setFormData({ name: '', roll_number: '', email: '', department: '', gender: 'Male', is_whitelisted: false }); }, [isOpen]);

    const addMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                ...formData,
                college: user.college,
                ug_cgpa: safeParseFloat(formData.ug_cgpa),
                backlogs: safeParseInt(formData.backlogs),
                last_modified_by_id: user.id,
                last_modified_by_name: user.name,
                last_modified_at: new Date().toISOString()
            };
            const { data, error } = await supabase.from('student_registry').insert(payload).select();
            if (error) throw error;

            logAdminAction(supabase, {
                admin_id: user.id,
                admin_name: user.name,
                action: 'CREATE',
                entity_type: 'student_registry',
                entity_id: data?.[0]?.id,
                details: { name: formData.name, roll_number: formData.roll_number, manual: true, whitelisted: formData.is_whitelisted }
            });
        },
        onSuccess: () => { toast.success("Student added!"); onClose(); },
        onError: (e: any) => toast.error(e.message)
    });

    const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manual Entry">
            <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }} className="space-y-4">
                <Input name="name" label="Name" value={formData.name} onChange={handleChange} required />
                <Input name="roll_number" label="Roll No" value={formData.roll_number} onChange={handleChange} required />
                <Input name="email" label="Email" type="email" value={formData.email} onChange={handleChange} required />
                <select
                    name="department"
                    value={user.department || formData.department}
                    onChange={handleChange}
                    disabled={!!user.department}
                    className={`w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-text-base ${user.department ? 'opacity-70 cursor-not-allowed' : ''}`}
                    required
                >
                    <option value="">Select Dept</option>
                    {displayDepts.map((d: any) => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-primary/20">
                    <input
                        type="checkbox"
                        id="is_whitelisted"
                        name="is_whitelisted"
                        checked={formData.is_whitelisted}
                        onChange={(e) => setFormData({ ...formData, is_whitelisted: e.target.checked })}
                        className="w-5 h-5 rounded border-primary/50 bg-input-bg text-primary focus:ring-primary"
                    />
                    <label htmlFor="is_whitelisted" className="text-sm font-bold text-primary select-none cursor-pointer">Mark as Academically Whitelisted</label>
                </div>
                <Button type="submit" className="w-full text-lg" disabled={addMutation.isPending}>{addMutation.isPending ? <Spinner /> : 'Save'}</Button>
            </form>
        </Modal>
    );
};

const BulkUploadModal: React.FC<{ isOpen: boolean; onClose: () => void; user: AdminProfile }> = ({ isOpen, onClose, user }) => {
    const supabase = useSupabase();
    const [file, setFile] = useState<File | null>(null);
    const [rawStagedStudents, setRawStagedStudents] = useState<StagedStudent[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // Progress percentage
    const [shouldBulkWhitelist, setShouldBulkWhitelist] = useState(false);
    const queryClient = useQueryClient();

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
                name: findCol(['name', 'studentname', 'fullname', 'candidatename']),
                roll: findCol(['rollnumber', 'rollno', 'htno', 'roll', 'hallticketno', 'htnumber']),
                email: findCol(['email', 'emailaddress', 'emailid', 'collegeemail']),
                dept: findCol(['department', 'dept', 'branch', 'course', 'stream']),
                cgpa: findCol(['cgpa', 'ugcgpa', 'gpa', 'gradepoint']),
                backlogs: findCol(['backlogs', 'currentbacklogs', 'activebacklogs']),
                passout: findCol(['passoutyear', 'ugpassoutyear', 'yearofpassing', 'batch'])
            };

            if (colMap.name === -1 || colMap.roll === -1 || colMap.email === -1) {
                const missing = [];
                if (colMap.name === -1) missing.push("Name");
                if (colMap.roll === -1) missing.push("Roll No/HT No");
                if (colMap.email === -1) missing.push("Email");
                throw new Error(`Missing columns: ${missing.join(', ')}.`);
            }

            const { data: existing } = await supabase.from('student_registry').select('roll_number').eq('college', user.college);
            const existingRolls = new Set(existing?.map(s => s.roll_number.toLowerCase()));

            const staged = jsonData.slice(1).map((row: any) => {
                const name = row[colMap.name];
                const roll = row[colMap.roll]?.toString().trim();
                const email = row[colMap.email]?.toString().trim();
                if (!name || !roll || !email) return null;

                const isUpdate = existingRolls.has(roll.toLowerCase());
                return {
                    name, roll_number: roll, email,
                    department: user.department || row[colMap.dept] || 'General',
                    verificationStatus: isUpdate ? 'update' : 'new',
                    verificationMessage: isUpdate ? 'Will update existing record' : 'New record',
                    parsedData: {
                        name, roll_number: roll, email, college: user.college,
                        department: user.department || row[colMap.dept] || 'General',
                        ug_cgpa: safeParseFloat(row[colMap.cgpa]),
                        backlogs: safeParseInt(row[colMap.backlogs]) ?? 0,
                        ug_passout_year: safeParseInt(row[colMap.passout])
                    }
                };
            }).filter(Boolean);
            setRawStagedStudents(staged as StagedStudent[]);
        } catch (e: any) { toast.error(e.message); } finally { setIsProcessing(false); }
    };

    const importMutation = useMutation({
        mutationFn: async () => {
            const students = rawStagedStudents.map(s => s.parsedData);
            const { data: existingData } = await supabase.from('student_registry').select('id, roll_number').eq('college', user.college);
            const idMap = new Map(existingData?.map(s => [s.roll_number.toLowerCase(), s.id]));

            const fullPayload = students.map(s => {
                const id = idMap.get(s.roll_number.toString().toLowerCase());
                const base = id ? {
                    ...s,
                    id,
                    last_modified_by_id: user.id,
                    last_modified_by_name: user.name,
                    last_modified_at: new Date().toISOString()
                } : {
                    ...s,
                    last_modified_by_id: user.id,
                    last_modified_by_name: user.name,
                    last_modified_at: new Date().toISOString()
                };
                return shouldBulkWhitelist ? { ...base, is_whitelisted: true } : base;
            });

            const BATCH_SIZE = 100;
            for (let i = 0; i < fullPayload.length; i += BATCH_SIZE) {
                const chunk = fullPayload.slice(i, i + BATCH_SIZE);
                const { error } = await supabase.from('student_registry').upsert(chunk, { onConflict: 'email' });
                if (error) throw error;
                setUploadProgress(Math.round(((i + chunk.length) / fullPayload.length) * 100));
            }

            logAdminAction(supabase, {
                admin_id: user.id,
                admin_name: user.name,
                action: 'UPDATE',
                entity_type: 'student_registry',
                entity_id: 'bulk_upload',
                details: { count: fullPayload.length, type: 'bulk_import_upsert', whitelisted: shouldBulkWhitelist }
            });
        },
        onSuccess: () => {
            toast.success("Bulk import/update successful!");
            queryClient.invalidateQueries({ queryKey: ['unified_students'] });
            onClose();
            setUploadProgress(0);
        },
        onError: (e: any) => {
            toast.error(e.message);
            setUploadProgress(0);
        }
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload">
            {!rawStagedStudents.length ? (
                <div className="text-center space-y-4">
                    <Input type="file" accept=".csv,.xlsx" onChange={e => {
                        const sFile = e.target.files?.[0];
                        if (sFile) { setFile(sFile); parseFile(sFile); }
                    }} />
                    {isProcessing && <Spinner />}
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-text-muted">Found {rawStagedStudents.length} records. ({rawStagedStudents.filter(s => s.verificationStatus === 'update').length} Updates)</p>

                    <div className="flex items-center gap-3 bg-secondary/10 p-3 rounded-lg border border-secondary/20">
                        <input
                            type="checkbox"
                            id="bulk_whitelist"
                            checked={shouldBulkWhitelist}
                            onChange={(e) => setShouldBulkWhitelist(e.target.checked)}
                            className="w-5 h-5 rounded border-secondary/50 bg-input-bg text-secondary focus:ring-secondary cursor-pointer"
                        />
                        <label htmlFor="bulk_whitelist" className="text-sm font-bold text-secondary select-none cursor-pointer">Whitelist all {rawStagedStudents.length} students</label>
                    </div>

                    {importMutation.isPending && (
                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => setRawStagedStudents([])} disabled={importMutation.isPending} className="flex-1">Cancel</Button>
                        <Button onClick={() => importMutation.mutate()} className="flex-[2] text-lg" disabled={importMutation.isPending}>
                            {importMutation.isPending ? `Uploading... ${uploadProgress}%` : 'Confirm Import'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default StudentDataManagementPage;
