
import React from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import type { AdminProfile } from '../../types.ts';

const ClubNexus: React.FC<{ user: AdminProfile }> = ({ user }) => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="font-display text-4xl text-primary">Club Nexus</h1>
                    <p className="text-text-muted">Student Activities & Event Management</p>
                </div>
                <Button variant="primary" className="text-sm">+ New Campaign</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card glow="primary" className="flex flex-col">
                    <div className="h-48 bg-white/5 rounded-lg mb-4 flex items-center justify-center border border-dashed border-white/20">
                        <span className="text-text-muted text-xs">Event Poster Preview</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Code-A-Thon 2024</h3>
                    <p className="text-sm text-text-muted mb-4">Tech Club • Oct 24th • Library Hall</p>
                    <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">ACTIVE</span>
                        <Button variant="ghost" className="text-[10px] py-1">View Responses</Button>
                    </div>
                </Card>

                <Card glow="secondary" className="flex flex-col">
                    <div className="h-48 bg-white/5 rounded-lg mb-4 flex items-center justify-center border border-dashed border-white/20">
                        <span className="text-text-muted text-xs">Cultural Fest Poster</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">Nexus Cultural Eve</h3>
                    <p className="text-sm text-text-muted mb-4">Admin • Dec 12th • Main Ground</p>
                    <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-bold">DRAFT</span>
                        <Button variant="secondary" className="text-[10px] py-1">Publish Now</Button>
                    </div>
                </Card>

                <Card className="border-dashed border-white/20 flex items-center justify-center text-center opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
                    <div>
                        <span className="text-5xl mb-4 block">🎪</span>
                        <p className="font-bold text-white">Register New Club</p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ClubNexus;
