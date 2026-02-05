
import React from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import type { AdminProfile } from '../../types.ts';

const FinanceVault: React.FC<{ user: AdminProfile }> = ({ user }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="font-display text-4xl text-secondary">Finance Vault</h1>
                    <p className="text-text-muted">Institutional Billing & Revenue Control</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="text-center p-6 border-secondary/30">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Total Collections</p>
                    <p className="text-3xl font-display text-secondary">₹4.2 Cr</p>
                </Card>
                <Card className="text-center p-6 border-primary/30">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Pending Dues</p>
                    <p className="text-3xl font-display text-primary">₹85 L</p>
                </Card>
                <Card className="text-center p-6 border-red-500/30">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Defaulters</p>
                    <p className="text-3xl font-display text-red-500">142</p>
                </Card>
                <Card className="text-center p-6 border-white/20">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Cash Desk Today</p>
                    <p className="text-3xl font-display text-white">₹2.4 L</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card glow="secondary">
                    <h3 className="text-xl font-display text-white mb-6">Payment Gateway Hub</h3>
                    <div className="space-y-3">
                        <Button variant="secondary" className="w-full text-sm">Generate Bulk Invoices</Button>
                        <Button variant="ghost" className="w-full text-sm border-secondary/50 text-secondary">Sync Razorpay Logs</Button>
                    </div>
                </Card>
                <Card glow="none" className="bg-black/40">
                    <h3 className="text-xl font-display text-white mb-6">Manual Receipt Generation</h3>
                    <div className="space-y-4">
                        <Input placeholder="Search Student Roll Number..." />
                        <Button className="w-full">Initiate Receipt</Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default FinanceVault;
