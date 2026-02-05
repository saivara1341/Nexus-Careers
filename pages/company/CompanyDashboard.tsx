
import React, { useState, useEffect } from 'react';
import type { CompanyProfile, Opportunity } from '../../types.ts';
import { Header } from '../../components/layout/Header.tsx';
import CorporateJobBoard from './CorporateJobBoard.tsx';
import PostCorporateJob from './PostCorporateJob.tsx';
import CompanyProfilePage from './CompanyProfilePage.tsx';
import CompanyPipelinePage from './CompanyPipelinePage.tsx';
import CorporateTeams from './CorporateTeams.tsx';
import { SupportSection } from '../../components/support/SupportSection.tsx';
import { MFAOverlay } from '../../components/auth/MFAOverlay.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface CompanyDashboardProps {
  onLogout: () => void;
  user: CompanyProfile;
}

type CompanyView = 'dashboard' | 'post-job' | 'profile' | 'pipeline' | 'teams' | 'support';

const DEFAULT_EXPANDED_SIDEBAR_WIDTH = 260;
const WIDGET_SIDEBAR_WIDTH = 70;
const MIN_RESIZABLE_WIDTH = 200;
const MAX_RESIZABLE_WIDTH = 350;

const SvgIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="h-5 w-5 md:h-6 md:w-6 flex-shrink-0">
        {children}
    </svg>
);

const NavItem: React.FC<{ text: string, active: boolean, onClick: () => void, icon: React.ReactNode, isSidebarCollapsed: boolean }> = ({ text, active, onClick, icon, isSidebarCollapsed }) => (
    <li>
        <button 
            onClick={onClick} 
            className={`
                w-full text-left font-display text-base md:text-lg p-3 md:p-3.5 rounded-lg transition-all duration-200 relative flex items-center gap-3 md:gap-4 group
                ${active 
                    ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_rgb(var(--color-primary-rgb))]" 
                    : 'text-text-muted hover:text-text-base hover:bg-white/5'
                }
            `}
        >
            <span className={`${active ? 'text-primary' : 'text-text-muted'}`}>{icon}</span>
            <span className={`whitespace-nowrap truncate overflow-hidden transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                {text}
            </span>
        </button>
    </li>
);

export const CompanyDashboard: React.FC<CompanyDashboardProps> = ({ onLogout, user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [activeView, setActiveView] = useState<CompanyView>('dashboard');
    const [selectedJob, setSelectedJob] = useState<Opportunity | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => JSON.parse(localStorage.getItem('companySidebarCollapsed') || 'false'));
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // AI Agent States
    const [aiDraft, setAiDraft] = useState<Partial<Opportunity> | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    useEffect(() => {
        const handleAgentCommand = (e: Event) => {
            const command = (e as CustomEvent).detail;
            if (command.type === 'NAVIGATE') {
                const viewMap: Record<string, CompanyView> = {
                    'dashboard': 'dashboard',
                    'post': 'post-job',
                    'teams': 'teams',
                    'profile': 'profile',
                    'support': 'support'
                };
                if (viewMap[command.view]) {
                    setActiveView(viewMap[command.view]);
                    toast(`Opening ${command.view}...`, { icon: '🤖' });
                }
            } else if (command.type === 'DRAFT_OPPORTUNITY') {
                setAiDraft({ ...command.data, company: user.company_name });
                toast.success("Recruiter Agent has drafted a role!");
            } else if (command.type === 'PUBLISH_OPPORTUNITY') {
                if (aiDraft) handleConfirmPublish();
                else toast.error("No job draft to launch.");
            }
        };

        window.addEventListener('NEXUS_AGENT_COMMAND', handleAgentCommand);
        return () => window.removeEventListener('NEXUS_AGENT_COMMAND', handleAgentCommand);
    }, [aiDraft, user.company_name]);

    const handleConfirmPublish = async () => {
        if (!aiDraft) return;
        setIsPublishing(true);
        try {
            const { error } = await supabase.from('opportunities').insert({
                ...aiDraft,
                posted_by: user.id,
                is_corporate: true,
                status: 'active',
                created_at: new Date().toISOString()
            });
            if (error) throw error;
            toast.success("Job Launch Sequence Complete!");
            queryClient.invalidateQueries({ queryKey: ['companyJobs'] });
            setAiDraft(null);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleViewPipeline = (job: Opportunity) => {
        setSelectedJob(job);
        setActiveView('pipeline');
    };

    const handleViewChange = (view: CompanyView) => {
        setActiveView(view);
        setIsMobileSidebarOpen(false);
    };

    const icons = {
        dashboard: <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></SvgIcon>,
        post: <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></SvgIcon>,
        teams: <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" /></SvgIcon>,
        settings: <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></SvgIcon>,
        support: <SvgIcon><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" /></SvgIcon>
    };

    return (
        <MFAOverlay user={user}>
            <div className="min-h-screen flex bg-background font-body text-text-base">
                {isMobileSidebarOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
                )}

                <nav className={`fixed inset-y-0 left-0 z-50 bg-card-bg/95 backdrop-blur-xl border-r border-primary/20 transform transition-transform duration-300 md:static md:translate-x-0 flex flex-col ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ width: isSidebarCollapsed ? '70px' : '260px' }}>
                    <div className="flex items-center justify-between p-5 border-b border-primary/10 h-[70px]">
                        {!isSidebarCollapsed && (
                            <div className="flex flex-col truncate">
                                <h2 className="font-display text-base font-black animated-gradient-text tracking-tighter leading-none uppercase">NEXUS CAREERS</h2>
                                <span className="text-[8px] text-text-muted uppercase tracking-widest mt-0.5">Corporate Portal</span>
                            </div>
                        )}
                        <button onClick={() => { setIsSidebarCollapsed(!isSidebarCollapsed); localStorage.setItem('companySidebarCollapsed', JSON.stringify(!isSidebarCollapsed)); }} className="hidden md:block mx-auto text-text-muted hover:text-white transition-colors">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarCollapsed ? "M13 5l7 7-7 7m5-14l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} /></svg>
                        </button>
                    </div>
                    
                    <ul className="space-y-1.5 flex-grow overflow-y-auto px-3 py-4 custom-scrollbar">
                        <NavItem isSidebarCollapsed={isSidebarCollapsed} text="Overview" active={activeView === 'dashboard'} onClick={() => handleViewChange('dashboard')} icon={icons.dashboard} />
                        <NavItem isSidebarCollapsed={isSidebarCollapsed} text="Post Job" active={activeView === 'post-job'} onClick={() => handleViewChange('post-job')} icon={icons.post} />
                        <NavItem isSidebarCollapsed={isSidebarCollapsed} text="Teams" active={activeView === 'teams'} onClick={() => handleViewChange('teams')} icon={icons.teams} />
                        <NavItem isSidebarCollapsed={isSidebarCollapsed} text="Profile" active={activeView === 'profile'} onClick={() => handleViewChange('profile')} icon={icons.settings} />
                        <NavItem isSidebarCollapsed={isSidebarCollapsed} text="Support" active={activeView === 'support'} onClick={() => handleViewChange('support')} icon={icons.support} />
                    </ul>
                </nav>

                <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                    <Header onLogout={onLogout} userName={user.name} userRole="Recruiter" user={user as any} onMenuClick={() => setIsMobileSidebarOpen(true)} />
                    <div className="flex-1 overflow-auto p-4 md:p-8">
                        <div className="max-w-[1600px] mx-auto">{renderView()}</div>
                    </div>
                </main>
            </div>

            {/* AI Agent Recruiter Verification Modal */}
            {aiDraft && (
                <Modal isOpen={!!aiDraft} onClose={() => setAiDraft(null)} title="AI Recruiter: Verify Job Draft">
                    <div className="space-y-4">
                        <div className="bg-secondary/10 p-4 rounded-lg border border-secondary/30 space-y-4">
                            <div><label className="text-xs text-text-muted uppercase font-bold">Job Title</label><p className="text-xl font-display text-white">{aiDraft.title}</p></div>
                            <div><label className="text-xs text-text-muted uppercase font-bold">Description</label><p className="text-sm text-text-base leading-relaxed">{aiDraft.description}</p></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs text-text-muted uppercase font-bold">CGPA Req</label><p className="text-sm font-mono text-white">{aiDraft.min_cgpa}</p></div>
                                <div><label className="text-xs text-text-muted uppercase font-bold">Target Campus</label><p className="text-sm text-white">{aiDraft.college || 'Anurag University'}</p></div>
                            </div>
                        </div>
                        <p className="text-xs text-text-muted italic">Launching this draft will instantly alert all qualified students.</p>
                        <div className="flex gap-4">
                            <Button variant="ghost" className="flex-1" onClick={() => setAiDraft(null)}>Edit Manually</Button>
                            <Button variant="secondary" className="flex-1" onClick={handleConfirmPublish} disabled={isPublishing}>
                                {isPublishing ? <Spinner className="w-5 h-5" /> : 'Confirm & Launch'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </MFAOverlay>
    );

    function renderView() {
        switch (activeView) {
            case 'post-job': return <PostCorporateJob user={user} onSuccess={() => setActiveView('dashboard')} onClose={() => setActiveView('dashboard')} />;
            case 'profile': return <CompanyProfilePage user={user} />;
            case 'teams': return <CorporateTeams user={user} />;
            case 'support': return <SupportSection user={user} />;
            case 'pipeline': return selectedJob && <CompanyPipelinePage opportunity={selectedJob} onBack={() => setActiveView('dashboard')} />;
            case 'dashboard':
            default: return <CorporateJobBoard user={user} onPostClick={() => setActiveView('post-job')} onViewPipeline={handleViewPipeline} />;
        }
    }
};

export default CompanyDashboard;
