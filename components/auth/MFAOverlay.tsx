
import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input.tsx';
import { Button } from '../ui/Button.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import type { AdminProfile, CompanyProfile } from '../../types.ts';
import toast from 'react-hot-toast';

interface MFAOverlayProps {
    user: AdminProfile | CompanyProfile;
    children: React.ReactNode;
}

export const MFAOverlay: React.FC<MFAOverlayProps> = ({ user, children }) => {
    const [isVerified, setIsVerified] = useState(false);
    const [showModal, setShowModal] = useState(false);
    
    // MFA State
    const [otp, setOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [employeeIdInput, setEmployeeIdInput] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 1. Check if MFA is enabled for this user
        if (!user.mfa_enabled) {
            setIsVerified(true);
            return;
        }

        // 2. Check if already verified in this session
        const sessionKey = `mfa_verified_${user.id}`;
        const isSessionVerified = sessionStorage.getItem(sessionKey);

        if (isSessionVerified === 'true') {
            setIsVerified(true);
        } else {
            setShowModal(true);
            // Default behavior: Auto-send OTP if that's the preferred method
            if (user.role === 'company' || (user as AdminProfile).mfa_method === 'otp') {
                sendOtp(); 
            }
        }
    }, [user]);

    const sendOtp = async () => {
        setLoading(true);
        // SIMULATION: In production, call Supabase Function to send SMS via Twilio/Msg91
        setTimeout(() => {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(code);
            console.log(`[MFA DEV] OTP for ${user.mobile_number}: ${code}`);
            toast.success(`OTP sent to ${user.mobile_number?.slice(-4).padStart(user.mobile_number?.length || 4, '*')}`, { duration: 5000 });
            toast(`DEV MODE CODE: ${code}`, { icon: '🔓', duration: 6000 });
            setLoading(false);
        }, 1500);
    };

    const handleBiometricAuth = async () => {
        if (!user.biometric_registered) {
            toast.error("Biometrics not enrolled for this device.");
            return;
        }

        setLoading(true);
        try {
            // Simulation of WebAuthn / Passkey interaction
            await new Promise(resolve => setTimeout(resolve, 1200));
            toast.success("Biometric Scan Successful");
            sessionStorage.setItem(`mfa_verified_${user.id}`, 'true');
            setIsVerified(true);
            setShowModal(false);
        } catch (e) {
            toast.error("Biometric authentication failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        let success = false;
        
        // Determine method
        const method = user.role === 'company' ? 'otp' : (user as AdminProfile).mfa_method;

        if (method === 'otp') {
            if (otp === generatedOtp) success = true;
            else toast.error("Invalid OTP. Please try again.");
        } else {
            // Employee ID Verification (Admins only)
            const adminUser = user as AdminProfile;
            if (employeeIdInput.trim() === adminUser.employee_id) success = true;
            else toast.error("Invalid Employee ID.");
        }

        setLoading(false);

        if (success) {
            toast.success("Identity Verified. Welcome.");
            sessionStorage.setItem(`mfa_verified_${user.id}`, 'true');
            setIsVerified(true);
            setShowModal(false);
        }
    };

    if (isVerified) return <>{children}</>;

    return (
        <div className="relative min-h-screen">
            <div className="blur-sm pointer-events-none select-none h-screen overflow-hidden" aria-hidden="true">
                {children}
            </div>
            
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-4">
                <div className="bg-card-bg border-2 border-primary shadow-[0_0_30px_rgba(0,255,255,0.3)] rounded-2xl p-8 max-w-md w-full animate-fade-in-up">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30 mb-4">
                            <span className="material-symbols-outlined text-4xl text-primary">security</span>
                        </div>
                        <h2 className="font-display text-3xl text-white text-center">Identity Check</h2>
                        <p className="text-center text-text-muted text-sm mt-1">Multi-Factor Authentication Required</p>
                    </div>

                    <div className="space-y-6">
                        {user.biometric_registered && (
                            <button 
                                onClick={handleBiometricAuth}
                                disabled={loading}
                                className="w-full bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary py-4 rounded-xl flex items-center justify-center gap-3 transition-all group"
                            >
                                <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">fingerprint</span>
                                <span className="font-bold uppercase tracking-widest text-xs">Verify with Biometrics</span>
                            </button>
                        )}

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-white/10"></div>
                            <span className="flex-shrink mx-4 text-[10px] text-text-muted font-bold uppercase tracking-widest">{user.biometric_registered ? 'OR' : 'VERIFICATION'}</span>
                            <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <form onSubmit={handleVerify} className="space-y-6">
                            {(user.role === 'company' || (user as AdminProfile).mfa_method === 'otp') ? (
                                <div className="space-y-4">
                                    <p className="text-xs text-center text-text-muted">
                                        Enter the 6-digit code sent to your registered number ending in <strong>{user.mobile_number?.slice(-4)}</strong>.
                                    </p>
                                    <Input 
                                        placeholder="000000" 
                                        value={otp} 
                                        onChange={e => setOtp(e.target.value)} 
                                        className="text-center text-2xl tracking-[0.3em] font-mono !p-4"
                                        maxLength={6}
                                    />
                                    <div className="flex justify-center">
                                        <button type="button" onClick={sendOtp} className="text-secondary text-xs font-bold uppercase hover:underline" disabled={loading}>
                                            Resend OTP
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-xs text-center text-text-muted uppercase tracking-wider">
                                        Enter your official <strong>Employee / Faculty ID</strong>
                                    </p>
                                    <Input 
                                        placeholder="e.g. EMP-2024-X" 
                                        value={employeeIdInput} 
                                        onChange={e => setEmployeeIdInput(e.target.value)} 
                                        className="text-center text-xl uppercase tracking-tighter"
                                    />
                                </div>
                            )}

                            <Button type="submit" className="w-full text-lg py-4 shadow-primary" disabled={loading}>
                                {loading ? <Spinner className="w-6 h-6 mx-auto" /> : 'Confirm Access'}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
