import React from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';

const StartupHub: React.FC = () => {
    return (
        <div className="space-y-6 animate-fade-in p-2 md:p-6">
            <header className="mb-8 text-left">
                <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter uppercase mb-2">
                    <span className="text-primary">Startup</span> <span className="text-white opacity-80">Hub</span>
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    From Sandbox to IPO: Ignite your entrepreneurial journey with institutional support.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card glow="primary" className="border-primary/20 bg-primary/5 p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">rocket_launch</span>
                            Incubation Support
                        </h2>
                        <p className="text-xs text-text-muted leading-relaxed mb-6">
                            Apply for official university incubation to get office space, mentorship, and legal aid.
                        </p>
                    </div>
                    <Button variant="primary" className="w-full text-xs">Register Startup</Button>
                </Card>

                <Card glow="secondary" className="border-secondary/20 bg-secondary/5 p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-secondary">inventory_2</span>
                            Free Developer Packs
                        </h2>
                        <p className="text-xs text-text-muted leading-relaxed mb-6">
                            Access $100k+ in free credits for AWS, GitHub Enterprise, and Premium SaaS tools.
                        </p>
                    </div>
                    <Button variant="secondary" className="w-full text-xs">Claim Free Tools</Button>
                </Card>

                <Card glow="none" className="border-white/10 p-6 flex flex-col justify-between bg-black/40">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-accent">payments</span>
                            Seed Funding
                        </h2>
                        <p className="text-xs text-text-muted leading-relaxed mb-6">
                            Pitch your idea to the institutional VC panel and secure up to ₹1,0,000 in early funding.
                        </p>
                    </div>
                    <Button variant="ghost" className="w-full text-xs border-primary/30">View Funding Cycle</Button>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                <Card glow="none" className="p-10 border-white/5 bg-card-bg/30 flex flex-col items-center justify-center text-center opacity-70 border-dashed">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-primary">auto_stories</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-primary mb-2 uppercase tracking-widest">Entrepreneur's Library</h3>
                    <p className="text-[10px] text-text-muted">Resources and guides are being curated by the Department of Innovation. Stay tuned.</p>
                </Card>

                <Card glow="none" className="p-10 border-white/5 bg-card-bg/30 flex flex-col items-center justify-center text-center opacity-70 border-dashed">
                    <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-secondary">person_search</span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-secondary mb-2 uppercase tracking-widest">Mentor Network</h3>
                    <p className="text-[10px] text-text-muted">Expert mentorship scheduling is currently being synchronized with faculty calendars.</p>
                </Card>
            </div>
        </div>
    );
};

export default StartupHub;
