
import React, { useState } from 'react';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { ReportIssueModal } from './ReportIssueModal.tsx';
import { AdminProfile, StudentProfile, CompanyProfile } from '../../types.ts';

interface SupportSectionProps {
    user: AdminProfile | StudentProfile | CompanyProfile;
}

export const SupportSection: React.FC<SupportSectionProps> = ({ user }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <header>
                    <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                        Help & Support
                    </h1>
                    <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                        Institutional technical assistance and incident reporting gateway.
                    </p>
                </header>
                <Button onClick={() => setIsModalOpen(true)} className="shadow-primary animate-pulse bg-red-500 hover:bg-red-600 text-white border-none text-sm py-2">
                    ⚠️ Report an Issue
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card glow="secondary" className="flex flex-col h-full border-secondary/30 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-secondary/10 rounded-full text-xl">📞</div>
                        <h3 className="font-display text-xl text-secondary">Contact Support</h3>
                    </div>
                    <p className="text-sm text-text-muted mb-6 flex-grow">
                        Facing technical difficulties with the Nexus platform? Our support team is on standby to assist you with critical issues.
                    </p>
                    <div className="space-y-2 text-sm bg-black/20 p-4 rounded-lg border border-white/5">
                        <p className="flex items-center gap-2"><span className="text-secondary">📧</span> <a href="mailto:support@nexuscareers.com" className="hover:underline">support@nexuscareers.com</a></p>
                        <p className="flex items-center gap-2"><span className="text-secondary">📞</span> +91 1800-NEXUS-HELP</p>
                        <p className="flex items-center gap-2"><span className="text-secondary">⏰</span> Mon-Fri, 9:00 AM - 6:00 PM IST</p>
                    </div>
                </Card>

                <Card glow="none" className="border-white/10 flex flex-col h-full p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-primary/10 rounded-full text-xl">❓</div>
                        <h3 className="font-display text-lg text-white">Frequently Asked Questions</h3>
                    </div>
                    <div className="space-y-3 flex-grow">
                        <div className="pb-2 border-b border-white/5">
                            <p className="font-bold text-primary text-sm mb-1">How do I reset my password?</p>
                            <p className="text-xs text-text-muted">Go to the login screen and click "Forgot Password". A reset link will be emailed to you.</p>
                        </div>
                        <div className="pb-2 border-b border-white/5">
                            <p className="font-bold text-primary text-sm mb-1">Where can I see my application status?</p>
                            <p className="text-xs text-text-muted">Check the "My Opportunities" section in your dashboard for real-time updates.</p>
                        </div>
                        <div>
                            <p className="font-bold text-primary text-sm mb-1">My profile data is incorrect.</p>
                            <p className="text-xs text-text-muted">Go to your Profile page and click "Request Data Correction" to notify the admin.</p>
                        </div>
                    </div>
                </Card>
            </div>

            <ReportIssueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={user}
            />
        </div>
    );
};
