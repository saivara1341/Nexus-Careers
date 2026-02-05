
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import type { AdminProfile } from '../../types.ts';

const AcademicHQ: React.FC<{ user: AdminProfile }> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'attendance' | 'marks'>('attendance');

    return (
        <div className="space-y-6">
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Academic HQ
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            {user.department || 'University'} Academic Operations, attendance tracking, and grading systems.
                        </p>
                    </div>
                    <div className="flex bg-card-bg/50 p-1 rounded-lg border border-primary/20 shrink-0">
                        <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-md text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all ${activeTab === 'attendance' ? 'bg-primary text-black shadow-md' : 'text-text-muted hover:text-white'}`}>Attendance</button>
                        <button onClick={() => setActiveTab('marks')} className={`px-4 py-2 rounded-md text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all ${activeTab === 'marks' ? 'bg-secondary text-black shadow-md' : 'text-text-muted hover:text-white'}`}>Marks Entry</button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card glow="primary" className="md:col-span-2">
                    <h3 className="text-xl font-display text-white mb-6">Active Session Management</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-white/5 rounded-lg border border-white/10 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-primary">Live Attendance Module</p>
                                <p className="text-xs text-text-muted">Take real-time biometric or roll-call attendance.</p>
                            </div>
                            <Button className="text-xs py-1">Open Module</Button>
                        </div>
                        <div className="p-4 bg-white/5 rounded-lg border border-white/10 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-secondary">Marks Spreadsheet</p>
                                <p className="text-xs text-text-muted">Import internal or external examination scores.</p>
                            </div>
                            <Button variant="secondary" className="text-xs py-1">Import XLSX</Button>
                        </div>
                    </div>
                </Card>

                <Card glow="none" className="bg-primary/5 border-primary/20">
                    <h3 className="text-lg font-display text-primary mb-4">Quick Stats</h3>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Avg Attendance</span>
                            <span className="font-bold text-white">82.4%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Pending Entry</span>
                            <span className="font-bold text-yellow-400">12 Classes</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Detention List</span>
                            <span className="font-bold text-red-400">4 Students</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AcademicHQ;
