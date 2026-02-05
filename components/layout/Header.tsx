
import React from 'react';
import { Button } from '../ui/Button.tsx';
import { AdminProfile, StudentProfile, CompanyProfile } from '../../types.ts';
import { NotificationBell } from '../admin/NotificationBell.tsx';

interface HeaderProps {
    onLogout: () => void;
    userName: string;
    userRole: string;
    user?: AdminProfile | StudentProfile | CompanyProfile;
    onProfileClick?: () => void;
    onNotificationsClick?: () => void;
    onMenuClick?: () => void;
    onSearchClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogout, userName, userRole, user, onProfileClick, onNotificationsClick, onMenuClick, onSearchClick }) => {
    return (
        <header className="bg-card-bg/80 backdrop-blur-lg border-b border-primary/20 sticky top-0 z-40">
            <div className="flex justify-between items-center px-4 py-3 md:px-6">
                <div className="flex items-center gap-4">
                    <button onClick={onMenuClick} className="md:hidden text-text-base p-2 -ml-2 rounded-full active:bg-white/5 flex items-center justify-center w-10 h-10">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div className="flex flex-col">
                        <h1 className="font-archivo-black text-2xl md:text-3xl tracking-tight leading-none uppercase animated-gradient-text">
                            NEXUS CAREERS
                        </h1>
                        <span className="text-[10px] text-text-muted/60 uppercase tracking-widest mt-1 font-bold hidden sm:block">Institutional Command Engine</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 md:gap-6">
                    <button
                        onClick={onSearchClick}
                        className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-text-muted hover:text-primary px-3 py-1.5 rounded-lg border border-primary/20 transition-all group"
                    >
                        <span className="material-symbols-outlined text-xl">search</span>
                        <span className="text-xs font-bold hidden lg:inline">Search</span>
                        <span className="text-[10px] opacity-40 hidden xl:inline border border-white/20 px-1 rounded ml-1 group-hover:border-primary/50 transition-colors">⌘K</span>
                    </button>
                    {user && <NotificationBell user={user as any} onClick={onNotificationsClick} />}
                    <button className='hidden sm:flex items-center gap-3 group focus:outline-none' onClick={onProfileClick}>
                        <div className="text-right">
                            <p className="font-display text-sm font-medium text-text-base truncate group-hover:text-primary transition-colors max-w-[150px]">{userName}</p>
                            <p className="text-[10px] text-secondary capitalize font-bold">{userRole}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10 overflow-hidden shadow-[0_0_10px_rgba(0,255,255,0.2)]">
                            {user?.profile_photo_url ? <img src={user.profile_photo_url} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center w-full h-full"><span className="material-symbols-outlined text-primary">person</span></div>}
                        </div>
                    </button>
                    <Button onClick={onLogout} variant="ghost" className="text-sm py-1.5 px-4 border-white/10 hover:border-primary/50 hover:text-primary !bg-transparent flex items-center gap-2">
                        <span className="hidden sm:inline">Logout</span>
                        <div className="flex items-center justify-center sm:hidden w-6 h-6">
                            <span className="material-symbols-outlined">logout</span>
                        </div>
                    </Button>
                </div>
            </div>
        </header>
    );
};
