
import React, { useState, useEffect } from 'react';
import type { AdminProfile, AdminRole, Opportunity } from '../../types.ts';
import { Header } from '../../components/layout/Header.tsx';
import StudentsHub from './StudentsHub.tsx';
import OpportunityManagement from './OpportunityManagement.tsx';
import StudentQueries from './StudentQueries.tsx';
import { StatisticsPage } from './StatisticsPage.tsx';
import StudentDataManagementPage from './StudentDataManagementPage.tsx';
import AIMentorPage from './AIMentorPage.tsx';
import FacultyManagementPage from './FacultyManagementPage.tsx';
import { UNIVERSITY_LEVEL_ROLES } from '../../types.ts';
import DepartmentManagementPage from './DepartmentManagementPage.tsx';
import DepartmentViewPage from './DepartmentViewPage.tsx';
import StudentPerformancePage from './StudentPerformancePage.tsx';
import { AdminProfilePage } from './AdminProfilePage.tsx';
import AdminLogsPage from './AdminLogsPage.tsx';
import { SupportSection } from '../../components/support/SupportSection.tsx';
import { MFAOverlay } from '../../components/auth/MFAOverlay.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
// Add missing useQueryClient import
import { useQueryClient } from '@tanstack/react-query';
import { NotificationsCenter } from '../../components/shared/NotificationsCenter.tsx';
import { CandidatePipelinePage } from './CandidatePipelinePage.tsx';
import toast from 'react-hot-toast';
import { GlobalSearch } from '../../components/admin/GlobalSearch.tsx';

interface AdminDashboardProps {
    onLogout: () => void;
    user: AdminProfile;
}

type AdminView = 'dashboard' | 'students-hub' | 'opportunities' | 'pipeline' | 'student-registry' | 'student-performance' | 'queries' | 'ai-mentor' | 'department-view' | 'profile' | 'support' | 'notifications' | 'logs';

const DEFAULT_EXPANDED_SIDEBAR_WIDTH = 260;
const WIDGET_SIDEBAR_WIDTH = 70;
const MIN_RESIZABLE_WIDTH = 200;
const MAX_RESIZABLE_WIDTH = 350;

const NavItem: React.FC<{ text: string, active: boolean, onClick: () => void, icon: string, isSidebarCollapsed: boolean }> = ({ text, active, onClick, icon, isSidebarCollapsed }) => (
    <li>
        <button
            onClick={onClick}
            title={isSidebarCollapsed ? text : undefined}
            className={`
                w-full text-left font-display text-base md:text-lg p-3 md:p-3.5 rounded-lg transition-all duration-200 relative flex items-center gap-3 md:gap-4
                ${active
                    ? "bg-secondary/10 text-secondary shadow-[inset_3px_0_0_0_rgb(var(--color-secondary-rgb))]"
                    : 'text-text-muted hover:text-text-base hover:bg-white/5'
                }
                ${isSidebarCollapsed ? 'justify-center' : ''}
            `}
        >
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                <span className={`material-symbols-outlined text-2xl ${active ? 'text-secondary' : 'text-text-muted'}`}>{icon}</span>
            </div>
            <span className={`whitespace-nowrap transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
                {text}
            </span>
        </button>
    </li>
);

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, user }) => {
    const supabase = useSupabase();
    // Initialize useQueryClient to manage cached data
    const queryClient = useQueryClient();
    const [activeView, setActiveView] = useState<AdminView>('dashboard');
    const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

    // Resizable Sidebar States
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        const stored = localStorage.getItem('adminSidebarWidth');
        return stored ? parseInt(stored, 10) : DEFAULT_EXPANDED_SIDEBAR_WIDTH;
    });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
        const stored = localStorage.getItem('adminSidebarCollapsed');
        return stored ? JSON.parse(stored) : false;
    });
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Keyboard Shortcut (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleCommand = (e: Event) => {
            const command = (e as CustomEvent).detail;
            if (command.type === 'NAVIGATE') {
                setActiveView(command.view);
                toast(`Opening ${command.view}...`, { icon: '🚀' });
            }
        };
        window.addEventListener('NEXUS_AGENT_COMMAND', handleCommand);
        return () => window.removeEventListener('NEXUS_AGENT_COMMAND', handleCommand);
    }, []);

    // Resizing Logic
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
        localStorage.setItem('adminSidebarWidth', sidebarWidth.toString());
    };

    const toggleDesktopSidebar = () => {
        const newState = !isSidebarCollapsed;
        setIsSidebarCollapsed(newState);
        localStorage.setItem('adminSidebarCollapsed', JSON.stringify(newState));
    };

    const handleViewChange = (view: AdminView) => {
        setActiveView(view);
        setIsMobileSidebarOpen(false);
    };

    const isUniversityLevel = UNIVERSITY_LEVEL_ROLES.includes(user.role as AdminRole);

    const adminNavItems = [
        { id: 'dashboard', label: 'Command Center', icon: 'leaderboard' },
        { id: 'profile', label: 'My Profile', icon: 'manage_accounts' },
    ];

    // University level specific or shared items
    adminNavItems.push({ id: 'students-hub', label: 'Students Hub', icon: 'groups' });
    adminNavItems.push({ id: 'opportunities', label: 'Placement Drives', icon: 'business_center' });

    // Deans/HODs/Dept-Specific Officers see Dept HQ
    if (user.department || user.role === 'Dean') {
        adminNavItems.push({ id: 'department-view', label: 'Dept HQ', icon: 'domain' });
    }

    // High level management see registry and analytics
    if (isUniversityLevel || user.role === 'HOD' || user.role === 'Faculty' || user.role === 'admin') {
        adminNavItems.push({ id: 'student-registry', label: 'Student Registry', icon: 'storage' });
        adminNavItems.push({ id: 'student-performance', label: 'Performance Analytics', icon: 'analytics' });
    }

    adminNavItems.push(
        { id: 'queries', label: 'Student Queries', icon: 'forum' },
        { id: 'ai-mentor', label: 'AI Mentor Lab', icon: 'psychology' },
        { id: 'logs', label: 'Forensic Logs', icon: 'history_edu' },
        { id: 'support', label: 'Support', icon: 'help_center' },
    );

    return (
        <MFAOverlay user={user}>
            <div className="min-h-screen flex bg-background font-body text-text-base">
                {isMobileSidebarOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
                )}

                <nav className={`fixed inset-y-0 left-0 z-50 bg-card-bg/95 backdrop-blur-xl border-r border-primary/20 transform transition-transform duration-300 md:static md:translate-x-0 flex flex-col ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                    style={{ width: isSidebarCollapsed ? `${WIDGET_SIDEBAR_WIDTH}px` : `${sidebarWidth}px` }}>

                    <div className="flex items-center justify-between p-5 mb-2 border-b border-primary/10 h-[70px]">
                        {!isSidebarCollapsed && (
                            <div className="flex flex-col truncate">
                                <h2 className="font-display text-sm md:text-base font-black tracking-tighter leading-none uppercase"
                                    style={{
                                        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                                    }}>
                                    <span style={{ color: '#4ade80' }}>ANURAG</span> <span className="text-white/80">UNIVERSITY</span>
                                </h2>
                                <span className="text-[8px] text-text-muted/60 uppercase tracking-[0.3em] mt-1 font-bold">Admin Interface</span>
                            </div>
                        )}

                        {/* Desktop Toggle */}
                        <button onClick={toggleDesktopSidebar} className="hidden md:block mx-auto text-text-muted hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5">
                            <span className="material-symbols-outlined">{isSidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}</span>
                        </button>

                        {/* Mobile Close Button */}
                        <button onClick={() => setIsMobileSidebarOpen(false)} className="md:hidden text-text-muted hover:text-white p-1">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <ul className="space-y-1 px-3 py-4 flex-grow overflow-y-auto custom-scrollbar">
                        {adminNavItems.map(item => (
                            <NavItem
                                key={item.id}
                                isSidebarCollapsed={isSidebarCollapsed}
                                text={item.label}
                                active={activeView === item.id || (item.id === 'opportunities' && activeView === 'pipeline')}
                                onClick={() => handleViewChange(item.id as AdminView)}
                                icon={item.icon}
                            />
                        ))}
                    </ul>

                    {/* Resizing Handle */}
                    <div
                        className={`hidden md:block absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-primary/50 transition-colors duration-200 ${isSidebarCollapsed ? 'pointer-events-none' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); if (!isSidebarCollapsed) setIsResizing(true); }}
                    />
                </nav>

                <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                    <Header
                        onLogout={onLogout}
                        userName={user.name}
                        userRole={user.role}
                        user={user}
                        onMenuClick={() => setIsMobileSidebarOpen(true)}
                        onProfileClick={() => setActiveView('profile')}
                        onNotificationsClick={() => setActiveView('notifications')}
                        onSearchClick={() => setIsSearchOpen(true)}
                    />

                    {/* Breadcrumbs */}
                    <div className="bg-primary/5 px-4 md:px-8 py-2 border-b border-primary/10 flex items-center gap-2 text-[10px] md:text-xs">
                        <button onClick={() => setActiveView('dashboard')} className="text-text-muted hover:text-primary transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">home</span> Command Center
                        </button>
                        <span className="text-primary/30">/</span>
                        <span className="text-primary font-bold uppercase tracking-wider">{activeView === 'student-performance' ? 'Performance Analytics' : activeView.replace('-', ' ')}</span>
                    </div>

                    <div className="flex-1 overflow-auto p-4 md:p-8">
                        {renderView()}
                    </div>
                </main>

                <GlobalSearch
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    onSelect={(type, id) => {
                        if (type === 'student') {
                            setActiveView('students-hub');
                            // We could pass the student ID to StudentsHub to auto-open it
                            toast(`Heading to Students Hub...`, { icon: '🔍' });
                        } else {
                            setActiveView('opportunities');
                            toast(`Heading to Placement Drives...`, { icon: '💼' });
                        }
                    }}
                />
            </div>
        </MFAOverlay>
    );

    function renderView() {
        switch (activeView) {
            case 'students-hub': return <StudentsHub user={user} />;
            case 'opportunities': return <OpportunityManagement user={user} onNavigateToPipeline={(opp) => { setSelectedOpportunity(opp); setActiveView('pipeline'); }} />;
            case 'pipeline': return selectedOpportunity ? <CandidatePipelinePage opportunity={selectedOpportunity} onBack={() => setActiveView('opportunities')} /> : <OpportunityManagement user={user} onNavigateToPipeline={(opp) => { setSelectedOpportunity(opp); setActiveView('pipeline'); }} />;
            case 'student-registry': return <StudentDataManagementPage user={user} />;
            case 'student-performance': return <StudentPerformancePage user={user} />;
            case 'queries': return <StudentQueries user={user} />;
            case 'ai-mentor': return <AIMentorPage />;
            case 'department-view': return <DepartmentViewPage user={user} />;
            case 'profile': return <AdminProfilePage user={user} />;
            case 'support': return <SupportSection user={user} />;
            case 'notifications': return <NotificationsCenter user={user} onClose={() => setActiveView('dashboard')} />;
            case 'logs': return <AdminLogsPage />;
            case 'dashboard':
            default: return <StatisticsPage user={user} />;
        }
    }
};

export default AdminDashboard;