
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { CompanyProfile } from '../../types.ts';
import toast from 'react-hot-toast';

const CompanySettings: React.FC<{ user: CompanyProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        company_name: user.company_name,
        industry: user.industry || '',
        website: user.website || '',
        description: user.description || '',
        location: user.location || '',
        name: user.name,
        mobile_number: user.mobile_number || '',
        mfa_enabled: user.mfa_enabled || false,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData({ 
            ...formData, 
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value 
        });
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
            const { error } = await supabase
                .from('companies')
                .update(formData)
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Company profile updated successfully.");
            // Reload for MFA checks
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="font-display text-4xl text-primary mb-6">Company Settings</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card glow="primary">
                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Company Name" name="company_name" value={formData.company_name} onChange={handleChange} required />
                                <Input label="Industry" name="industry" value={formData.industry} onChange={handleChange} />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Contact Person" name="name" value={formData.name} onChange={handleChange} required />
                                <Input label="Website" name="website" value={formData.website} onChange={handleChange} placeholder="https://" />
                            </div>

                            <Input label="Location / HQ" name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Hyderabad, India" />

                            <div>
                                <label className="block text-primary font-display text-lg mb-2">About Company</label>
                                <textarea 
                                    name="description" 
                                    value={formData.description} 
                                    onChange={handleChange} 
                                    className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-text-base h-32 focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="Describe your company culture and vision..."
                                />
                            </div>

                            <div className="border-t border-primary/20 pt-4">
                                <h3 className="text-xl font-display text-secondary mb-4">Security</h3>
                                <Input label="Mobile Number (for OTP)" name="mobile_number" value={formData.mobile_number} onChange={handleChange} placeholder="+91..." />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Spinner /> : 'Save Changes'}
                            </Button>
                        </form>
                    </Card>
                </div>

                {/* Security / MFA Panel */}
                <div className="lg:col-span-1">
                    <Card glow="secondary" className="h-full">
                        <h2 className="font-display text-2xl text-secondary mb-4">Access Control</h2>
                        <p className="text-sm text-text-muted mb-6">
                            Enable Multi-Factor Authentication to secure your corporate account.
                        </p>

                        <div className="flex items-center justify-between bg-input-bg p-3 rounded-md border border-primary/30">
                            <span className="font-bold text-text-base">Enable MFA</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    name="mfa_enabled"
                                    checked={formData.mfa_enabled} 
                                    onChange={handleChange} 
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                        {formData.mfa_enabled && <p className="text-xs text-green-400 mt-2">MFA Active via Mobile OTP.</p>}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default CompanySettings;
