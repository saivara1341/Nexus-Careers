
import React, { useState, useEffect } from 'react';
import { Header } from '../../components/layout/Header.tsx';
import type { StudentProfile } from '../../types.ts';
import OpportunityBoard from './OpportunityBoard.tsx';
import MyApplications from './MyApplications.tsx';
import ProfilePage from './ProfilePage.tsx';
import CareerToolkit from './CareerToolkit.tsx';
import { ResourceExchangePage } from './ResourceExchangePage.tsx';
import ImHerePage from './ImHerePage.tsx';
import ArcadePage from './ArcadePage.tsx';
import IdeaCafePage from './IdeaCafePage.tsx';
import CalendarPage from './CalendarPage.tsx';
// Fix: Updated import to use named export from MockTestPage.tsx.
import { MockTestPage } from './MockTestPage.tsx';
import { VirtualCampusPage } from './VirtualCampusPage.tsx';
import StartupHub from '../../components/student/StartupHub.tsx';
import CareerCompass from '../../components/student/CareerCompass.tsx';
import { SupportSection } from '../../components/support/SupportSection.tsx';
import { UpcomingDeadlinesCard } from '../../components/student/UpcomingDeadlinesCard.tsx';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatContext } from '../../contexts/ChatContext.tsx';
import { NotificationsCenter } from '../../components/shared/NotificationsCenter.tsx';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';

interface StudentDashboardProps {
    onLogout: () => void;
    user: StudentProfile;
}

type StudentView = 'dashboard' | 'opportunities' | 'applications' | 'profile' | 'toolkit' | 'earn-exchange' | 'im-here' | 'arcade' | 'idea-cafe' | 'calendar' | 'alumni' | 'support' | 'virtual-campus' | 'notifications' | 'startup-hub' | 'nexus-geeks' | 'career-compass';

const DEFAULT_EXPANDED_SIDEBAR_WIDTH = 260;
const WIDGET_SIDEBAR_WIDTH = 70;
const MIN_RESIZABLE_WIDTH = 200;
const MAX_RESIZABLE_WIDTH = 350;

const NavItem: React.FC<{ text: string, active: boolean, onClick: () => void, icon: string, isSidebarCollapsed: boolean }> = ({ text, active, onClick, isSidebarCollapsed, icon }) => (
    <li>
        <button
            onClick={onClick}
            title={isSidebarCollapsed ? text : undefined}
            className={`
                w-full text-left font-display text-base md:text-lg p-3 md:p-3.5 rounded-lg transition-all duration-200 relative flex items-center gap-3 md:gap-4
                ${active
                    ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_rgb(var(--color-primary-rgb))]"
                    : 'text-text-muted hover:text-text-base hover:bg-white/5'
                }
                ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
        >
            <span className={`material-symbols-outlined text-2xl ${active ? 'text-primary' : 'text-text-muted'}`}>{icon}</span>
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                {text}
            </span>
        </button>
    </li>
);

const DailyQuestsCard: React.FC<{ user: StudentProfile, onClaim: (xp: number) => void }> = ({ user, onClaim }) => {
    const [quests, setQuests] = useState<any[]>([]);

    const handleClaim = (id: number, xp: number) => {
        setQuests(prev => prev.map(q => q.id === id ? { ...q, claimed: true } : q));
        onClaim(xp);
    };

    return (
        <Card glow="secondary" className="h-full">
            <h3 className="font-display text-lg md:text-xl text-secondary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">assignment</span> Daily Quests
            </h3>
            <div className="space-y-3 flex-grow flex flex-col">
                {quests.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-black/20 rounded-lg border border-white/5 border-dashed lg:p-12">
                        <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                            <span className="material-symbols-outlined text-secondary">sync</span>
                        </div>
                        <p className="text-sm font-bold text-white mb-1 uppercase tracking-tighter">Syncing Quests...</p>
                        <p className="text-[10px] text-text-muted leading-relaxed">Daily quests are personalized and synchronized every 24 hours. Check back later for your next challenge!</p>
                    </div>
                ) : quests.map(quest => {
                    const isComplete = quest.progress >= quest.total;
                    const percent = (quest.progress / quest.total) * 100;

                    return (
                        <div key={quest.id} className={`p-3 rounded-lg border transition-all ${isComplete ? 'bg-green-500/10 border-green-500/30' : 'bg-black/20 border-white/5'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className={`font-bold text-sm ${isComplete ? 'text-green-400' : 'text-text-base'}`}>{quest.title}</p>
                                    <p className="text-[10px] md:text-xs text-text-muted">{quest.desc}</p>
                                </div>
                                <span className="text-xs font-mono text-secondary">+{quest.xp} XP</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-grow h-1.5 bg-black rounded-full overflow-hidden">
                                    <div className="h-full bg-secondary transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                </div>
                                {isComplete && !quest.claimed ? (
                                    <button onClick={() => handleClaim(quest.id, quest.xp)} className="text-[10px] bg-secondary text-black font-bold px-2 py-1 rounded animate-pulse">CLAIM</button>
                                ) : quest.claimed ? (
                                    <span className="text-[10px] text-green-500 font-bold">✓ DONE</span>
                                ) : (
                                    <span className="text-[10px] text-text-muted">{quest.progress}/{quest.total}</span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </Card>
    );
};

const LeaderboardCard: React.FC<{ students: StudentProfile[], title: string }> = ({ students, title }) => (
    <Card glow="primary" className="h-full">
        <h3 className="font-display text-lg md:text-xl text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">emoji_events</span> {title}
        </h3>
        <div className="space-y-2">
            {students.length === 0 && <p className="text-text-muted text-sm text-center py-4">No data yet.</p>}
            {students.map((student, index) => (
                <div key={student.id} className={`flex items-center gap-3 p-2.5 rounded-md border ${index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-black/20 border-white/5'}`}>
                    <span className={`font-display text-lg w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-text-muted'}`}>
                        {index + 1}
                    </span>
                    <div className="flex-grow min-w-0">
                        <p className="font-bold text-text-base truncate text-sm">{student.name}</p>
                        <p className="text-[10px] text-text-muted truncate">{student.department} • {student.roll_number}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-display text-sm text-primary">{student.xp} XP</p>
                    </div>
                </div>
            ))}
        </div>
    </Card>
);

const fetchXpHistory = async (supabase: any, userId: string) => {
    const { data: services, error: servicesError } = await supabase
        .from('service_requests')
        .select('updated_at, status, service:campus_resources(item_name)')
        .eq('offerer_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

    if (servicesError) throw servicesError;

    const { data: imHereRequests, error: imHereError } = await supabase
        .from('im_here_requests')
        .select('updated_at, item_description')
        .eq('offerer_id', userId)
        .eq('status', 'fulfilled')
        .order('updated_at', { ascending: false });

    if (imHereError) throw imHereError;

    const history = [
        ...(services || []).map((s: any) => ({
            id: `srv-${s.updated_at}`,
            action: `Provided Service: ${s.service?.item_name}`,
            date: s.updated_at,
            points: 20
        })),
        ...(imHereRequests || []).map((req: any) => ({
            id: `imhere-${req.updated_at}`,
            action: `Helped Request: ${req.item_description}`,
            date: req.updated_at,
            points: 10
        }))
    ];

    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onLogout, user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const { setContext } = useChatContext();
    const [activeView, setActiveView] = useState<StudentView>('dashboard');
    const [topStudents, setTopStudents] = useState<StudentProfile[]>([]);
    const [isXpHistoryModalOpen, setIsXpHistoryModalOpen] = useState(false);

    const { data: xpHistory = [], isLoading: isLoadingHistory } = useQuery({
        queryKey: ['xpHistory', user.id],
        queryFn: () => fetchXpHistory(supabase, user.id),
        enabled: isXpHistoryModalOpen
    });

    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        const stored = localStorage.getItem('studentSidebarWidth');
        return stored ? parseInt(stored, 10) : DEFAULT_EXPANDED_SIDEBAR_WIDTH;
    });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
        const stored = localStorage.getItem('studentSidebarCollapsed');
        return stored ? JSON.parse(stored) : false;
    });
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        setContext(`${activeView} view`);
    }, [activeView, setContext]);

    useEffect(() => {
        if (activeView === 'dashboard') {
            const fetchLeaderboard = async () => {
                const { data } = await supabase.from('students').select('id, name, department, xp, roll_number').eq('college', user.college).order('xp', { ascending: false }).limit(5);
                setTopStudents((data as StudentProfile[]) || []);
            };
            fetchLeaderboard();
        }
    }, [user.college, activeView, supabase]);

    useEffect(() => {
        if (isResizing && !isSidebarCollapsed) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, isSidebarCollapsed]);

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        let newWidth = e.clientX;
        if (newWidth < MIN_RESIZABLE_WIDTH) newWidth = MIN_RESIZABLE_WIDTH;
        if (newWidth > MAX_RESIZABLE_WIDTH) newWidth = MAX_RESIZABLE_WIDTH;
        setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
        setIsResizing(false);
        localStorage.setItem('studentSidebarWidth', sidebarWidth.toString());
    };

    const toggleDesktopSidebar = () => {
        const newState = !isSidebarCollapsed;
        setIsSidebarCollapsed(newState);
        localStorage.setItem('studentSidebarCollapsed', JSON.stringify(newState));
    };

    const studentNavItems = [
        { id: 'dashboard', label: 'Command Center', icon: 'dashboard' },
        { id: 'opportunities', label: 'Job Board', icon: 'work' },
        { id: 'applications', label: 'My Opportunities', icon: 'assignment_turned_in' },
        { id: 'calendar', label: 'Schedules', icon: 'calendar_month' },
        { id: 'toolkit', label: 'AI Career Toolkit', icon: 'smart_toy' },
        { id: 'arcade', label: 'Arcade', icon: 'sports_esports' },
        { id: 'earn-exchange', label: 'Nexus Gigs', icon: 'handyman' },
        { id: 'im-here', label: "I'm Here Help", icon: 'hail' },
        { id: 'alumni', label: "Alumni Network", icon: 'school' },
        { id: 'startup-hub', label: "Startup Hub", icon: 'rocket_launch' },
        { id: 'career-compass', label: "Career Compass", icon: 'explore' },
        { id: 'support', label: "Help & Support", icon: 'contact_support' },
    ];

    const handleViewChange = (view: StudentView) => {
        setActiveView(view);
        setIsMobileSidebarOpen(false);
    };

    const handleClaimQuest = async (xp: number) => {
        await supabase.rpc('award_xp', { user_id: user.id, xp_amount: xp });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        toast(`+${xp} XP Claimed!`, { icon: '✨', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
    };

    const renderView = () => {
        switch (activeView) {
            case 'virtual-campus': return <VirtualCampusPage />;
            case 'opportunities': return <OpportunityBoard user={user} />;
            case 'applications': return <MyApplications user={user} />;
            case 'profile': return <ProfilePage user={user} />;
            case 'toolkit': return <CareerToolkit user={user} />;
            case 'earn-exchange': return <ResourceExchangePage user={user} />;
            case 'im-here': return <ImHerePage user={user} />;
            case 'arcade': return <ArcadePage user={user} />;
            case 'idea-cafe': return <IdeaCafePage user={user} />;
            case 'calendar': return <CalendarPage user={user} />;
            case 'startup-hub': return <StartupHub />;
            case 'career-compass': return <CareerCompass />;
            case 'support': return <SupportSection user={user} />;
            case 'notifications': return <NotificationsCenter user={user} onClose={() => setActiveView('dashboard')} />;
            case 'alumni': return (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-5xl text-primary">school</span>
                    </div>
                    <h2 className="text-2xl font-display text-primary mb-2">Alumni Network</h2>
                    <p className="text-text-muted">Coming Soon. Connect with seniors and get referrals.</p>
                </div>
            );
            case 'dashboard':
            default: return (
                <div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                        <header className="mb-2">
                            <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-1 text-primary">
                                Command Center
                            </h1>
                            <p className="text-text-muted text-sm font-mono italic">Welcome back, {user.name.split(' ')[0]}. Institutional monitoring active.</p>
                        </header>
                        <div
                            className="bg-primary/10 px-4 py-2 rounded-lg border border-primary/20 flex items-center gap-3 cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={() => setIsXpHistoryModalOpen(true)}
                            title="Click to view XP History"
                        >
                            <div>
                                <span className="text-[10px] text-text-muted uppercase tracking-widest block">Current Level</span>
                                <span className="text-xl md:text-2xl font-display text-primary">{user.level}</span>
                            </div>
                            <div className="h-8 w-[1px] bg-primary/20"></div>
                            <div>
                                <span className="text-[10px] text-text-muted uppercase tracking-widest block">Total XP</span>
                                <span className="text-lg md:text-xl font-mono text-secondary">{user.xp}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20 md:mb-0">
                        <div className="md:col-span-2 lg:col-span-2 space-y-6">
                            <UpcomingDeadlinesCard user={user} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <DailyQuestsCard user={user} onClaim={handleClaimQuest} />
                                <Card glow="none" className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/20 cursor-pointer hover:border-indigo-500/50 transition-all" onClick={() => setActiveView('toolkit')}>
                                    <h3 className="font-display text-lg md:text-xl text-white mb-2">🚀 Exam Readiness</h3>
                                    <p className="text-xs md:text-sm text-gray-300 mb-4">Take a mock test to gauge your prep.</p>
                                    <div className="w-full bg-black/30 rounded h-8 flex items-center justify-center text-xs font-bold text-indigo-200 border border-indigo-500/30">
                                        Go to Exam Hall
                                    </div>
                                </Card>
                            </div>

                            <Card glow="primary" className="relative overflow-hidden cursor-pointer group" onClick={() => handleViewChange('virtual-campus')}>
                                <div className="absolute inset-0 bg-[url('https://pannellum.org/images/alma.jpg')] bg-cover bg-center opacity-30 group-hover:scale-105 transition-transform duration-700"></div>
                                <div className="relative z-10 p-4">
                                    <h3 className="font-display text-2xl text-white mb-2">Explore the Campus</h3>
                                    <p className="text-sm text-text-muted mb-4 max-w-md">Take a 360° virtual tour of the university. Visit the library, canteen, and labs right from here.</p>
                                    <Button className="text-xs">Start Tour</Button>
                                </div>
                            </Card>
                        </div>
                        <div className="lg:col-span-1">
                            <LeaderboardCard students={topStudents} title="Top Students" />
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="min-h-screen flex font-body bg-background text-text-base">
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}

            <nav
                className={`
                    fixed inset-y-0 left-0 z-50 bg-card-bg/95 backdrop-blur-xl border-r border-primary/20 shadow-2xl
                    transform transition-transform duration-300 ease-in-out
                    hidden md:flex md:flex-col md:static md:translate-x-0 md:shadow-none
                `}
                style={{ width: isSidebarCollapsed ? `${WIDGET_SIDEBAR_WIDTH}px` : `${sidebarWidth}px` }}
            >
                <div className="flex items-center justify-between p-5 border-b border-primary/10 h-[70px]">
                    {!isSidebarCollapsed && (
                        <div className="flex flex-col truncate">
                            <h2 className="font-display text-sm md:text-base font-black tracking-tighter leading-none uppercase"
                                style={{
                                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                                }}>
                                <span style={{ color: '#4ade80' }}>ANURAG</span> <span className="text-white/80">UNIVERSITY</span>
                            </h2>
                            <span className="text-[8px] text-text-muted/60 uppercase tracking-[0.3em] mt-1 font-bold">Student Interface</span>
                        </div>
                    )}
                    <button
                        onClick={toggleDesktopSidebar}
                        className="text-text-muted hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
                    >
                        <span className="material-symbols-outlined">{isSidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}</span>
                    </button>
                </div>

                <ul className="space-y-1.5 flex-grow overflow-y-auto px-3 py-4 custom-scrollbar">
                    {studentNavItems.map(item => (
                        <NavItem
                            key={item.id}
                            text={item.label}
                            active={activeView === item.id}
                            onClick={() => handleViewChange(item.id as StudentView)}
                            icon={item.icon}
                            isSidebarCollapsed={window.innerWidth >= 768 && isSidebarCollapsed}
                        />
                    ))}
                </ul>

                <div
                    className={`hidden md:block absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-primary/50 transition-colors duration-200 ${isSidebarCollapsed ? 'pointer-events-none' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); if (!isSidebarCollapsed) setIsResizing(true); }}
                />
            </nav>

            <nav
                className={`
                    fixed inset-y-0 left-0 z-50 bg-card-bg/95 backdrop-blur-xl border-r border-primary/20 shadow-2xl w-64
                    transform transition-transform duration-300 ease-in-out md:hidden
                    ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="flex items-center justify-between p-5 border-b border-primary/10 h-[70px]">
                    <div className="flex flex-col">
                        <h2 className="font-display text-base md:text-lg font-black tracking-tighter leading-none uppercase"
                            style={{
                                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                            }}>
                            <span style={{ color: '#4ade80' }}>ANURAG</span> <span className="text-white/80">UNIVERSITY</span>
                        </h2>
                        <span className="text-[8px] text-text-muted/60 uppercase tracking-[0.3em] mt-1 font-bold">Mobile Gateway</span>
                    </div>
                    <button
                        onClick={() => setIsMobileSidebarOpen(false)}
                        className="text-text-muted hover:text-white p-1"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <ul className="space-y-1.5 p-3 overflow-y-auto h-[calc(100%-70px)]">
                    {studentNavItems.map(item => (
                        <NavItem
                            key={item.id}
                            text={item.label}
                            active={activeView === item.id}
                            onClick={() => handleViewChange(item.id as StudentView)}
                            icon={item.icon}
                            isSidebarCollapsed={false}
                        />
                    ))}
                </ul>
            </nav>

            <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
                <Header
                    onLogout={onLogout}
                    userName={user.name}
                    userRole={user.role}
                    user={user}
                    onProfileClick={() => handleViewChange('profile')}
                    onNotificationsClick={() => handleViewChange('notifications')}
                    onMenuClick={() => setIsMobileSidebarOpen(true)}
                />
                <div className={`flex-1 overflow-y-auto scroll-smooth pb-24 md:pb-8 ${activeView === 'virtual-campus' ? 'p-0' : 'p-4 md:p-8'}`}>
                    <div className="w-full h-full">
                        {renderView()}
                    </div>
                </div>
            </main>

            <Modal isOpen={isXpHistoryModalOpen} onClose={() => setIsXpHistoryModalOpen(false)} title="XP History">
                <div className="space-y-4">
                    <p className="text-text-muted">History of services provided and milestones achieved.</p>
                    {isLoadingHistory ? (
                        <div className="flex justify-center p-4"><Spinner /></div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto space-y-2">
                            {xpHistory.length === 0 && <p className="text-center text-text-muted italic">No service history found.</p>}
                            {xpHistory.map((item: any) => (
                                <div key={item.id} className="bg-card-bg p-3 rounded border border-primary/20 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-sm text-text-base">{item.action}</p>
                                        <p className="text-xs text-text-muted">{new Date(item.date).toLocaleDateString()}</p>
                                    </div>
                                    <span className="text-secondary font-bold font-mono">+{item.points} XP</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default StudentDashboard;