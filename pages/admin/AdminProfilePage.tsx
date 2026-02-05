
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { AdminProfile } from '../../types.ts';
import toast from 'react-hot-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const uploadAdminPhoto = async (supabase: any, userId: string, file: File) => {
    const filePath = `avatars/${userId}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage.from('student-credentials').upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('student-credentials').getPublicUrl(data.path);
    return urlData.publicUrl;
};

export const AdminProfilePage: React.FC<{ user: AdminProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'incubation' | 'security'>('details');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isRegisteringBio, setIsRegisteringBio] = useState(false);

    const [formData, setFormData] = useState({
        name: user.name,
        mobile_number: user.mobile_number || '',
        employee_id: user.employee_id || '',
        mfa_enabled: user.mfa_enabled || false,
        mfa_method: user.mfa_method || 'otp',
        biometric_registered: user.biometric_registered || false,
        // Incubation Cell
        is_incubation_lead: user.is_incubation_lead || false,
        incubation_cell_name: user.incubation_cell_name || '',
        incubation_services_str: user.incubation_services?.join(', ') || ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const photoUploadMutation = useMutation({
        mutationFn: async (file: File) => {
            setIsUploadingPhoto(true);
            try {
                const url = await uploadAdminPhoto(supabase, user.id, file);
                const { error } = await supabase.from('admins').update({ profile_photo_url: url }).eq('id', user.id);
                if (error) throw error;
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

    const registerBiometrics = async () => {
        setIsRegisteringBio(true);
        try {
            // Simulate WebAuthn Registration
            // In a real application, this would involve WebAuthn API calls (navigator.credentials.create)
            // to generate a credential and store it securely.
            await new Promise(resolve => setTimeout(resolve, 1500));
            const { error } = await supabase.from('admins').update({ biometric_registered: true }).eq('id', user.id);
            if (error) throw error;
            setFormData(prev => ({ ...prev, biometric_registered: true }));
            toast.success("Current device enrolled for Biometric access!");
            queryClient.invalidateQueries({ queryKey: ['userProfile'] }); // Invalidate to update the user context globally
        } catch (e: any) {
            toast.error("Failed to enroll biometrics.");
        } finally {
            setIsRegisteringBio(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const services = formData.incubation_services_str.split(',').map(s => s.trim()).filter(Boolean);
            const { error } = await supabase
                .from('admins')
                .update({
                    name: formData.name,
                    mobile_number: formData.mobile_number,
                    employee_id: formData.employee_id,
                    mfa_enabled: formData.mfa_enabled,
                    mfa_method: formData.mfa_method,
                    is_incubation_lead: formData.is_incubation_lead,
                    incubation_cell_name: formData.incubation_cell_name,
                    incubation_services: services
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Profile updated.");
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        } catch (error: any) {
            toast.error(`Update failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 font-body">
            <header className="mb-8">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                    Admin Profile
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    Institutional identity management, security protocols, and administrative clearance.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                    <Card glow="primary" className="p-0 overflow-hidden aspect-[1.6]">
                        <div className="bg-gradient-to-br from-gray-900 to-black h-full p-6 relative">
                            <div className="absolute top-4 right-4 text-primary opacity-20"><span className="material-symbols-outlined text-5xl">account_balance</span></div>
                            <div className="flex items-center gap-4 h-full">
                                <div className="w-20 h-24 bg-black border border-white/20 rounded relative overflow-hidden group">
                                    {user.profile_photo_url ? <img src={user.profile_photo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl font-bold">{user.name.charAt(0)}</div>}
                                    <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <input type="file" className="hidden" onChange={e => e.target.files?.[0] && photoUploadMutation.mutate(e.target.files[0])} />
                                        <span className="text-[10px] font-bold text-white">UPDATE</span>
                                    </label>
                                </div>
                                <div>
                                    <h2 className="font-display text-xl text-white leading-tight">{user.name}</h2>
                                    <p className="text-secondary text-sm font-bold uppercase tracking-wider">{user.role}</p>
                                    <p className="text-text-muted text-xs">{user.college}</p>
                                </div>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary"></div>
                        </div>
                    </Card>

                    {/* Biometric Status Card */}
                    <Card glow="none" className="bg-black/40 border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="material-symbols-outlined text-primary">fingerprint</span>
                            <h4 className="font-display text-sm text-white">Biometric Status</h4>
                        </div>
                        <p className="text-xs text-text-muted mb-4">Enable TouchID/FaceID for faster institutional access.</p>
                        {formData.biometric_registered ? (
                            <div className="bg-green-500/10 border border-green-500/30 p-2 rounded flex items-center justify-between">
                                <span className="text-[10px] text-green-400 font-bold uppercase">Device Enrolled</span>
                                <span className="material-symbols-outlined text-green-400 text-sm">verified_user</span>
                            </div>
                        ) : (
                            <Button onClick={registerBiometrics} variant="ghost" className="w-full text-xs py-2 h-9 border-primary/30" disabled={isRegisteringBio}>
                                {isRegisteringBio ? <Spinner className="w-4 h-4 mx-auto" /> : 'Enroll This Device'}
                            </Button>
                        )}
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card glow="none" className="h-full flex flex-col border-white/10">
                        <div className="flex border-b border-white/10 mb-6">
                            {[
                                { id: 'details', label: 'Details', icon: 'person' },
                                { id: 'incubation', label: 'Incubation', icon: 'rocket_launch' },
                                { id: 'security', label: 'Security', icon: 'shield' }
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-3 text-sm font-bold transition-all relative flex items-center gap-2 ${activeTab === tab.id ? 'text-primary' : 'text-text-muted hover:text-white'}`}>
                                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                                    {tab.label}
                                    {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            {activeTab === 'details' && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Input label="Name" name="name" value={formData.name} onChange={handleChange} />
                                        <Input label="Email" value={user.email} disabled className="opacity-50" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <Input label="Employee ID" name="employee_id" value={formData.employee_id} onChange={handleChange} />
                                        <Input label="Mobile" name="mobile_number" value={formData.mobile_number} onChange={handleChange} />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'incubation' && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-white">Incubation Cell Access</h4>
                                            <p className="text-xs text-text-muted">Allow students to pitch ideas to your campus unit.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="is_incubation_lead" checked={formData.is_incubation_lead} onChange={handleChange} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>

                                    {formData.is_incubation_lead && (
                                        <div className="space-y-4">
                                            <Input label="Cell Name" name="incubation_cell_name" value={formData.incubation_cell_name} onChange={handleChange} placeholder="e.g. Anurag Innovation Cell" />
                                            <div>
                                                <label className="block text-primary font-display text-sm mb-2">Cell Services (Comma separated)</label>
                                                <textarea name="incubation_services_str" value={formData.incubation_services_str} onChange={handleChange} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-sm" placeholder="e.g. Free Patenting, LLP Registration, Seed Funding" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'security' && (
                                <div className="space-y-6 animate-fade-in-up">
                                    <div className="flex items-center justify-between bg-black/40 p-4 rounded-lg border border-white/10">
                                        <div>
                                            <h4 className="font-bold text-white">Multi-Factor Authentication</h4>
                                            <p className="text-xs text-text-muted">Enhance login security with secondary verification.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="mfa_enabled" checked={formData.mfa_enabled} onChange={handleChange} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>

                                    {formData.mfa_enabled && (
                                        <div className="p-4 bg-primary/5 rounded border border-primary/20 space-y-4">
                                            <label className="block text-primary font-bold text-xs uppercase tracking-widest">Preferred Method</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <label className={`p-3 rounded border cursor-pointer transition-all flex items-center gap-3 ${formData.mfa_method === 'otp' ? 'bg-primary/20 border-primary text-primary' : 'bg-black/20 border-white/10 text-text-muted'}`}>
                                                    <input type="radio" name="mfa_method" value="otp" checked={formData.mfa_method === 'otp'} onChange={handleChange} className="hidden" />
                                                    <span className="material-symbols-outlined">sms</span>
                                                    <span className="text-xs font-bold uppercase">Mobile OTP</span>
                                                </label>
                                                <label className={`p-3 rounded border cursor-pointer transition-all flex items-center gap-3 ${formData.mfa_method === 'employee_id' ? 'bg-primary/20 border-primary text-primary' : 'bg-black/20 border-white/10 text-text-muted'}`}>
                                                    <input type="radio" name="mfa_method" value="employee_id" checked={formData.mfa_method === 'employee_id'} onChange={handleChange} className="hidden" />
                                                    <span className="material-symbols-outlined">badge</span>
                                                    <span className="text-xs font-bold uppercase">Employee ID</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-auto pt-6 flex justify-end">
                                <Button type="submit" disabled={isLoading} className="w-full md:w-auto shadow-primary">
                                    {isLoading ? <Spinner /> : 'Sync Profile Changes'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
};
