
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { CompanyProfile } from '../../types.ts';
import toast from 'react-hot-toast';
import { runAI } from '../../services/aiClient.ts';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const CompanyProfilePage: React.FC<{ user: CompanyProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(false);
    const [isAiOptimizing, setIsAiOptimizing] = useState(false);
    const [isRegisteringBio, setIsRegisteringBio] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');
    
    // File State
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);

    // Combined State
    const [formData, setFormData] = useState({
        // Brand Profile
        company_name: user.company_name,
        tagline: user.tagline || '',
        industry: user.industry || '',
        company_size: user.company_size || '100-500',
        website: user.website || '',
        linkedin_url: user.linkedin_url || '',
        description: user.description || '',
        location: user.location || '',
        
        // Visuals (URLs)
        logo_url: user.logo_url || '',
        banner_url: user.banner_url || '',

        // Account / Security
        name: user.name, // Contact Person
        mobile_number: user.mobile_number || '',
        mfa_enabled: user.mfa_enabled || false,
        biometric_registered: user.biometric_registered || false,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData({ 
            ...formData, 
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value 
        });
    };

    const uploadAsset = async (file: File, type: 'logo' | 'banner') => {
        const fileName = `company-assets/${user.id}/${type}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error } = await supabase.storage.from('student-credentials').upload(fileName, file, { upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('student-credentials').getPublicUrl(fileName);
        return data.publicUrl;
    };

    const registerBiometrics = async () => {
        setIsRegisteringBio(true);
        try {
            // Simulate WebAuthn Registration
            await new Promise(resolve => setTimeout(resolve, 1500));
            const { error } = await supabase.from('companies').update({ biometric_registered: true }).eq('id', user.id);
            if (error) throw error;
            setFormData(prev => ({ ...prev, biometric_registered: true }));
            toast.success("Device biometric ID linked successfully!");
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        } catch (e: any) {
            toast.error("Failed to link biometrics.");
        } finally {
            setIsRegisteringBio(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        if (formData.mfa_enabled && !formData.mobile_number) {
            toast.error("Mobile number is required to enable MFA.");
            setIsLoading(false);
            return;
        }

        try {
            let updatedData = { ...formData };

            if (logoFile) updatedData.logo_url = await uploadAsset(logoFile, 'logo');
            if (bannerFile) updatedData.banner_url = await uploadAsset(bannerFile, 'banner');

            const { error } = await supabase
                .from('companies')
                .update(updatedData)
                .eq('id', user.id);

            if (error) throw error;
            setFormData(updatedData);
            setLogoFile(null);
            setBannerFile(null);
            toast.success("Corporate profile updated.");
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAiEnhance = async () => {
        if (!formData.description) return toast.error("Please enter a basic description first.");
        setIsAiOptimizing(true);
        try {
            const result = await runAI({
                task: 'chat',
                payload: {
                    message: `Rewrite this company description to be exciting and attractive to Gen-Z graduates. Max 200 words.
                    Company: ${formData.company_name}
                    Industry: ${formData.industry}
                    Raw Description: ${formData.description}`,
                    history: []
                },
                supabase
            });
            setFormData(prev => ({ ...prev, description: result.text }));
            toast.success("AI Profile Optimization complete!");
        } catch (e: any) {
            handleAiInvocationError(e);
        } finally {
            setIsAiOptimizing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 font-body">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="font-display text-3xl md:text-4xl text-primary mb-2">Corporate Brand Identity</h1>
                    <p className="text-text-muted text-sm uppercase tracking-widest font-bold">Employer Presence Management</p>
                </div>
                <div className="flex bg-card-bg border border-white/10 rounded-lg p-1">
                    <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'profile' ? 'bg-primary text-black' : 'text-text-muted hover:text-white'}`}>
                        <span className="material-symbols-outlined text-sm">storefront</span> Brand Profile
                    </button>
                    <button onClick={() => setActiveTab('account')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'account' ? 'bg-secondary text-black' : 'text-text-muted hover:text-white'}`}>
                        <span className="material-symbols-outlined text-sm">security</span> Security
                    </button>
                </div>
            </div>

            <form onSubmit={handleSave}>
                {activeTab === 'profile' && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div className="relative w-full h-40 md:h-64 rounded-2xl overflow-hidden border border-white/10 group shadow-2xl">
                            {formData.banner_url || bannerFile ? (
                                <img src={bannerFile ? URL.createObjectURL(bannerFile) : formData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl text-white/20">image</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all"></div>
                            
                            <div className="absolute bottom-6 left-8 flex items-end gap-5">
                                <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-2xl border-4 border-black overflow-hidden shadow-2xl flex-shrink-0">
                                    {formData.logo_url || logoFile ? (
                                        <img src={logoFile ? URL.createObjectURL(logoFile) : formData.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">{formData.company_name.charAt(0)}</div>
                                    )}
                                </div>
                                <div className="mb-2">
                                    <h2 className="text-2xl md:text-4xl font-display text-white drop-shadow-lg flex items-center gap-2">
                                        {formData.company_name}
                                        <span className="material-symbols-outlined text-blue-400 text-2xl">verified</span>
                                    </h2>
                                    <p className="text-white/90 text-sm md:text-lg font-medium drop-shadow-lg">{formData.tagline || 'Define your corporate vision.'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-1 space-y-6">
                                <Card glow="none" className="border-white/10 p-5">
                                    <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">info</span> Core Identity
                                    </h3>
                                    <div className="space-y-4">
                                        <Input label="Entity Name" name="company_name" value={formData.company_name} onChange={handleChange} />
                                        <Input label="Tagline" name="tagline" value={formData.tagline} onChange={handleChange} placeholder="e.g. Innovating the Future" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-primary font-display text-xs font-bold uppercase mb-1">Sector</label>
                                                <Input name="industry" value={formData.industry} onChange={handleChange} />
                                            </div>
                                            <div>
                                                <label className="block text-primary font-display text-xs font-bold uppercase mb-1">Scale</label>
                                                <select name="company_size" value={formData.company_size} onChange={handleChange} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-2 text-sm text-text-base focus:ring-1 focus:ring-primary outline-none">
                                                    <option>1-50</option><option>50-200</option><option>200-1000</option><option>1000-5000</option><option>5000+</option>
                                                </select>
                                            </div>
                                        </div>
                                        <Input label="Official Website" name="website" value={formData.website} onChange={handleChange} placeholder="https://" />
                                        <Input label="Corporate LinkedIn" name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/company/..." />
                                        <Input label="Global HQ" name="location" value={formData.location} onChange={handleChange} placeholder="City, Country" />
                                    </div>
                                </Card>
                                <Card glow="none" className="border-white/10 p-5">
                                    <h3 className="text-sm font-bold text-secondary uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">palette</span> Visual Assets
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-secondary font-display text-xs font-bold uppercase mb-2">Logo Upload</label>
                                            <input type="file" accept="image/*" className="w-full text-xs text-text-muted file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-secondary/20 file:text-secondary hover:file:bg-secondary/30 transition-all" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                                        </div>
                                        <div>
                                            <label className="block text-secondary font-display text-xs font-bold uppercase mb-2">Cover Banner</label>
                                            <input type="file" accept="image/*" className="w-full text-xs text-text-muted file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-secondary/20 file:text-secondary hover:file:bg-secondary/30 transition-all" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            <div className="lg:col-span-2">
                                <Card glow="primary" className="h-full flex flex-col p-6 border-primary/20">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-display text-white flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">description</span> Employer Value Proposition
                                        </h3>
                                        <Button type="button" variant="secondary" onClick={handleAiEnhance} disabled={isAiOptimizing} className="text-[10px] py-1 h-8 shadow-secondary">
                                            {isAiOptimizing ? <Spinner className="w-3 h-3" /> : '✨ AI BRAND OPTIMIZER'}
                                        </Button>
                                    </div>
                                    <textarea name="description" value={formData.description} onChange={handleChange} className="flex-grow w-full bg-input-bg border-2 border-primary/30 rounded-xl p-5 text-sm text-text-base focus:outline-none focus:border-primary min-h-[400px] leading-relaxed custom-scrollbar" placeholder="Draft your story. Mention mission, culture, and what you look for in early talent..." />
                                    <p className="text-[10px] text-text-muted mt-4 italic uppercase tracking-widest">This content is visible to all students on the campus board.</p>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
                        <Card glow="secondary" className="p-6">
                            <h3 className="text-lg font-display text-secondary mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined">contact_mail</span> Admin Contact
                            </h3>
                            <div className="space-y-4">
                                <Input label="Point of Contact" name="name" value={formData.name} onChange={handleChange} />
                                <Input label="Account Email" value={user.email} disabled className="opacity-50" />
                                <Input label="Contact Mobile" name="mobile_number" value={formData.mobile_number} onChange={handleChange} placeholder="+91..." />
                            </div>
                        </Card>

                        <Card glow="none" className="border-white/10 p-6 bg-black/20">
                            <h3 className="text-lg font-display text-white mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined">verified_user</span> Multi-Factor & Biometrics
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-white/5 group hover:border-primary/30 transition-all">
                                    <div>
                                        <span className="font-bold text-white block text-sm">Require OTP Verification</span>
                                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest">Secure Login Flow</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" name="mfa_enabled" checked={formData.mfa_enabled} onChange={handleChange} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-green-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                                    </label>
                                </div>

                                <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-white/5 group hover:border-primary/30 transition-all">
                                    <div>
                                        <span className="font-bold text-white block text-sm">Biometric Unlock</span>
                                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-widest">{formData.biometric_registered ? 'Linked to this device' : 'Faster Login Access'}</span>
                                    </div>
                                    {formData.biometric_registered ? (
                                        <span className="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
                                    ) : (
                                        <Button type="button" variant="ghost" onClick={registerBiometrics} className="text-[10px] h-8 py-1 border-primary/20" disabled={isRegisteringBio}>
                                            {isRegisteringBio ? <Spinner className="w-3 h-3" /> : 'Register Device'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl p-4 border-t border-white/10 flex justify-end z-40 safe-area-pb md:static md:bg-transparent md:border-none md:mt-10">
                    <Button type="submit" disabled={isLoading} className="w-full md:w-auto shadow-primary text-sm min-w-[200px]">
                        {isLoading ? <Spinner className="w-5 h-5 mx-auto" /> : 'Finalize Profile Sync'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CompanyProfilePage;
