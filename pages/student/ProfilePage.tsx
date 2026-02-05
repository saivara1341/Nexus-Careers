
import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { StudentProfile, StudentCertification, StudentAchievement } from '../../types.ts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { runAI } from '../../services/aiClient.ts';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';

interface ProfilePageProps {
    user: StudentProfile;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'academics' | 'skills' | 'credentials' | 'settings'>('academics');

    const [isAddCertOpen, setIsAddCertOpen] = useState(false);
    const [isAddAchieveOpen, setIsAddAchieveOpen] = useState(false);
    const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);

    // Structured correction fields
    const [correctionFields, setCorrectionFields] = useState({
        cgpa: user.ug_cgpa?.toString() || '0.0',
        backlogs: user.backlogs?.toString() || '0'
    });

    const [settingsForm, setSettingsForm] = useState<Partial<StudentProfile>>(user);
    const [newSkill, setNewSkill] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    // Queries
    const { data: certifications = [], isLoading: isLoadingCerts } = useQuery({
        queryKey: ['studentCertifications', user.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('student_certifications').select('*').eq('student_id', user.id);
            if (error) throw error;
            return data as StudentCertification[];
        }
    });

    const { data: achievements = [], isLoading: isLoadingAchieve } = useQuery({
        queryKey: ['studentAchievements', user.id],
        queryFn: async () => {
            const { data, error } = await supabase.from('student_achievements').select('*').eq('student_id', user.id);
            if (error) throw error;
            return data as StudentAchievement[];
        }
    });

    // Mutations
    const updateProfileMutation = useMutation({
        mutationFn: async (updates: Partial<StudentProfile>) => {
            const { role, id, created_at, ...safeUpdates } = updates as any;
            const { error } = await supabase.from('students').update(safeUpdates).eq('id', user.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Profile Updated");
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        },
        onError: (e) => toast.error(e.message)
    });

    const correctionMutation = useMutation({
        mutationFn: async () => {
            const queryMessage = `DATA CORRECTION REQUEST: Student is reporting incorrect registry data. Expected CGPA: ${correctionFields.cgpa}, Expected Backlogs: ${correctionFields.backlogs}. Please verify and update registry.`;

            const { error } = await supabase.from('student_queries').insert({
                student_id: user.id,
                student_name: user.name,
                college: user.college,
                query_message: queryMessage,
                status: 'open'
            });

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Correction request sent to administration.");
            setIsCorrectionOpen(false);
        },
        onError: (e: any) => toast.error(e.message)
    });

    const handleAddSkill = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSkill.trim()) return;
        const updatedSkills = [...(user.skills || []), newSkill.trim()];
        updateProfileMutation.mutate({ skills: updatedSkills });
        setNewSkill('');
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        const updatedSkills = (user.skills || []).filter(s => s !== skillToRemove);
        updateProfileMutation.mutate({ skills: updatedSkills });
    };

    const photoUploadMutation = useMutation({
        mutationFn: async (file: File) => {
            setIsUploadingPhoto(true);
            try {
                const filePath = `avatars/${user.id}/${Date.now()}.jpg`;
                const { data, error } = await supabase.storage.from('student-credentials').upload(filePath, file, { upsert: true });
                if (error) throw error;
                const { data: urlData } = supabase.storage.from('student-credentials').getPublicUrl(data.path);
                const url = urlData.publicUrl;

                const { error: updateError } = await supabase.from('students').update({ profile_photo_url: url }).eq('id', user.id);
                if (updateError) throw updateError;
                return url;
            } finally {
                setIsUploadingPhoto(false);
            }
        },
        onSuccess: () => {
            toast.success("Profile photo updated!");
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        },
        onError: (e: any) => {
            toast.error(e.message || "Failed to update photo");
            setIsUploadingPhoto(false);
        }
    });

    return (
        <div className="max-w-7xl mx-auto pb-20 font-body">
            <header className="mb-8">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Student Profile
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    Universal student identity, academic credentials, and skill validation engine.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                    {/* Identity Card */}
                    <Card glow="primary" className="bg-gradient-to-br from-gray-900 to-black border-white/20 p-6 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-16 h-16 bg-gray-800 rounded-full border-2 border-primary/50 overflow-hidden flex items-center justify-center relative group cursor-pointer">
                                    {user.profile_photo_url ? (
                                        <img src={user.profile_photo_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-2xl font-bold text-primary">{user.name.charAt(0)}</span>
                                    )}
                                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <input type="file" className="hidden" onChange={e => e.target.files?.[0] && photoUploadMutation.mutate(e.target.files[0])} />
                                        <span className="text-[10px] font-bold text-white">CHANGE</span>
                                    </label>
                                    {isUploadingPhoto && <div className="absolute inset-0 bg-black/80 flex items-center justify-center"><Spinner className="w-4 h-4" /></div>}
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Level {user.level}</p>
                                    <p className="text-sm font-mono text-white">{user.xp} XP</p>
                                </div>
                            </div>
                            <h2 className="text-xl font-display text-white">{user.name}</h2>
                            <p className="text-text-muted text-sm font-student-label">{user.roll_number}</p>
                            <p className="text-xs text-primary mt-2 font-bold uppercase tracking-tighter">{user.department}</p>
                            <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${(user.xp / user.xp_to_next_level) * 100}%` }}></div>
                            </div>
                        </div>
                    </Card>

                    <Card glow="none" className="bg-black/40 border-white/5">
                        <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Placement Status</h3>
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-sm text-white font-medium">Eligible for Drives</span>
                        </div>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <div className="flex border-b border-white/10 mb-6 overflow-x-auto custom-scrollbar">
                        {['academics', 'skills', 'credentials', 'settings'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-6 py-3 text-sm font-bold capitalize transition-all border-b-2 whitespace-nowrap ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-white'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* ACADEMICS TAB */}
                    {activeTab === 'academics' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card glow="none" className="bg-white/5 border-white/5">
                                    <p className="text-[10px] text-text-muted uppercase font-bold mb-1">UG CGPA</p>
                                    <p className="text-3xl font-display text-primary">{user.ug_cgpa?.toFixed(2) || '0.00'}</p>
                                </Card>
                                <Card glow="none" className="bg-white/5 border-white/5">
                                    <p className="text-[10px] text-text-muted uppercase font-bold mb-1">Active Backlogs</p>
                                    <p className={`text-3xl font-display ${user.backlogs > 0 ? 'text-red-400' : 'text-green-400'}`}>{user.backlogs}</p>
                                </Card>
                                <Card glow="none" className="bg-white/5 border-white/5">
                                    <p className="text-[10px] text-text-muted uppercase font-bold mb-1">Inter / Diploma %</p>
                                    <p className="text-2xl font-display text-white">{user.inter_diploma_percentage || 'N/A'}%</p>
                                </Card>
                                <Card glow="none" className="bg-white/5 border-white/5">
                                    <p className="text-[10px] text-text-muted uppercase font-bold mb-1">10th Class %</p>
                                    <p className="text-2xl font-display text-white">{user.tenth_percentage || 'N/A'}%</p>
                                </Card>
                            </div>

                            <Card glow="none" className="border-primary/20 bg-primary/5">
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div>
                                        <h3 className="font-bold text-white">Registry Verification</h3>
                                        <p className="text-xs text-text-muted mt-1">This data is synced from the official university registry.</p>
                                    </div>
                                    <Button variant="ghost" onClick={() => {
                                        setCorrectionFields({ cgpa: user.ug_cgpa.toString(), backlogs: user.backlogs.toString() });
                                        setIsCorrectionOpen(true);
                                    }} className="text-xs border-primary/30">Request Correction</Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* SKILLS TAB */}
                    {activeTab === 'skills' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <Card glow="none" className="border-white/10">
                                <h3 className="font-display text-lg text-white mb-4">My Technical Stack</h3>
                                <form onSubmit={handleAddSkill} className="flex gap-2 mb-6">
                                    <Input
                                        placeholder="Add skill (e.g. React, Python...)"
                                        value={newSkill}
                                        onChange={e => setNewSkill(e.target.value)}
                                        className="!py-2 !text-sm"
                                    />
                                    <Button type="submit" className="text-sm px-4" disabled={updateProfileMutation.isPending}>Add</Button>
                                </form>

                                <div className="flex flex-wrap gap-2">
                                    {(!user.skills || user.skills.length === 0) ? (
                                        <p className="text-text-muted text-sm italic py-4">No skills added yet. Start typing above.</p>
                                    ) : (
                                        user.skills.map(skill => (
                                            <div key={skill} className="bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-full flex items-center gap-2 group hover:border-primary transition-all">
                                                <span className="text-sm font-bold">{skill}</span>
                                                <button
                                                    onClick={() => handleRemoveSkill(skill)}
                                                    className="text-primary/50 hover:text-red-400 transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>

                            <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-lg">
                                <h4 className="text-secondary font-bold text-xs uppercase tracking-widest mb-2">Pro Tip</h4>
                                <p className="text-sm text-text-muted leading-relaxed">
                                    Listing core skills accurately increases your **AI Match Score** on the Job Board. Focus on specific frameworks and languages.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* CREDENTIALS TAB */}
                    {activeTab === 'credentials' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <Card glow="none" className="border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-display text-lg text-white">Certifications</h3>
                                    <Button variant="ghost" className="text-xs" onClick={() => setIsAddCertOpen(true)}>+ Add</Button>
                                </div>
                                <div className="space-y-3">
                                    {isLoadingCerts ? <Spinner /> : certifications.length === 0 ? <p className="text-text-muted text-sm italic">None added yet.</p> : (
                                        certifications.map(c => (
                                            <div key={c.id} className="p-3 bg-black/30 rounded border border-white/5 flex justify-between items-center">
                                                <div>
                                                    <p className="font-bold text-sm text-primary">{c.name}</p>
                                                    <p className="text-[10px] text-text-muted uppercase">{c.issuing_organization}</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    {c.credential_url && <a href={c.credential_url} target="_blank" className="text-xs text-blue-400 hover:underline">View</a>}
                                                    <button className="text-red-500 hover:text-red-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>

                            <Card glow="none" className="border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-display text-lg text-white">Achievements</h3>
                                    <Button variant="ghost" className="text-xs" onClick={() => setIsAddAchieveOpen(true)}>+ Add</Button>
                                </div>
                                <div className="space-y-3">
                                    {isLoadingAchieve ? <Spinner /> : achievements.length === 0 ? <p className="text-text-muted text-sm italic">None added yet.</p> : (
                                        achievements.map(a => (
                                            <div key={a.id} className="p-3 bg-black/30 rounded border border-white/5 flex justify-between items-start">
                                                <p className="text-sm text-text-base">{a.description}</p>
                                                <button className="text-red-500 hover:text-red-400 flex-shrink-0 ml-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <Card glow="none" className="animate-fade-in-up border-white/10">
                            <h3 className="font-display text-lg text-white mb-6">Account Settings</h3>
                            <div className="space-y-4">
                                <Input label="Mobile Number" value={settingsForm.mobile_number || ''} onChange={e => setSettingsForm({ ...settingsForm, mobile_number: e.target.value })} />
                                <Input label="Personal Email" value={settingsForm.personal_email || ''} onChange={e => setSettingsForm({ ...settingsForm, personal_email: e.target.value })} />
                                <Input label="LinkedIn URL" value={settingsForm.linkedin_profile_url || ''} onChange={e => setSettingsForm({ ...settingsForm, linkedin_profile_url: e.target.value })} />
                                <Input label="GitHub URL" value={settingsForm.github_profile_url || ''} onChange={e => setSettingsForm({ ...settingsForm, github_profile_url: e.target.value })} />
                                <Button onClick={() => updateProfileMutation.mutate(settingsForm)} disabled={updateProfileMutation.isPending} className="w-full">
                                    {updateProfileMutation.isPending ? <Spinner /> : 'Save Details'}
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* MODALS */}
            <Modal isOpen={isCorrectionOpen} onClose={() => setIsCorrectionOpen(false)} title="Request Data Correction">
                <div className="space-y-6">
                    <p className="text-sm text-text-muted">Admins will verify your official documents before updating your official registry records.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Correct CGPA"
                            type="number"
                            step="0.01"
                            value={correctionFields.cgpa}
                            onChange={e => setCorrectionFields({ ...correctionFields, cgpa: e.target.value })}
                        />
                        <Input
                            label="Correct Backlogs"
                            type="number"
                            value={correctionFields.backlogs}
                            onChange={e => setCorrectionFields({ ...correctionFields, backlogs: e.target.value })}
                        />
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded text-[10px] text-yellow-200 uppercase tracking-widest font-bold">
                        Verification required by University TPO / Registrar.
                    </div>

                    <Button
                        onClick={() => correctionMutation.mutate()}
                        className="w-full"
                        disabled={correctionMutation.isPending}
                    >
                        {correctionMutation.isPending ? <Spinner className="w-5 h-5" /> : 'Submit Correction Request'}
                    </Button>
                </div>
            </Modal>

            <AddCertificationModal isOpen={isAddCertOpen} onClose={() => setIsAddCertOpen(false)} studentId={user.id} />
            <AddAchievementModal isOpen={isAddAchieveOpen} onClose={() => setIsAddAchieveOpen(false)} studentId={user.id} />
        </div>
    );
};

const AddCertificationModal: React.FC<{ isOpen: boolean; onClose: () => void; studentId: string }> = ({ isOpen, onClose, studentId }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({ name: '', issuing_organization: '', credential_url: '' });
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let fileUrl = null;
            if (file) {
                const path = `certs/${studentId}/${Date.now()}_${file.name}`;
                const { data } = await supabase.storage.from('student-credentials').upload(path, file);
                if (data) fileUrl = supabase.storage.from('student-credentials').getPublicUrl(path).data.publicUrl;
            }
            const { error } = await supabase.from('student_certifications').insert({
                ...formData, student_id: studentId, credential_file_url: fileUrl
            });
            if (error) throw error;
            toast.success("Certification saved!");
            queryClient.invalidateQueries({ queryKey: ['studentCertifications', studentId] });
            onClose();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Certification">
            <form onSubmit={handleSave} className="space-y-4">
                <Input label="Certification Name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <Input label="Issuing Organization" required value={formData.issuing_organization} onChange={e => setFormData({ ...formData, issuing_organization: e.target.value })} />
                <Input label="Credential URL (Optional)" value={formData.credential_url} onChange={e => setFormData({ ...formData, credential_url: e.target.value })} />
                <Input label="Attachment (PDF/Image)" type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
                <Button type="submit" disabled={isSaving} className="w-full">{isSaving ? <Spinner /> : "Save Certification"}</Button>
            </form>
        </Modal>
    );
};

const AddAchievementModal: React.FC<{ isOpen: boolean; onClose: () => void; studentId: string }> = ({ isOpen, onClose, studentId }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [desc, setDesc] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const { error } = await supabase.from('student_achievements').insert({ student_id: studentId, description: desc });
            if (error) throw error;
            toast.success("Achievement saved!");
            queryClient.invalidateQueries({ queryKey: ['studentAchievements', studentId] });
            onClose();
        } catch (e: any) { toast.error(e.message); }
        finally { setIsSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Achievement">
            <form onSubmit={handleSave} className="space-y-4">
                <textarea className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-white h-32" placeholder="Describe your achievement..." value={desc} onChange={e => setDesc(e.target.value)} required />
                <Button type="submit" disabled={isSaving} className="w-full">{isSaving ? <Spinner /> : "Save Achievement"}</Button>
            </form>
        </Modal>
    );
};

export default ProfilePage;
