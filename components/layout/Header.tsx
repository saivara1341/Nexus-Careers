
import React from 'react';
import { AdminProfile, StudentProfile, CompanyProfile } from '../../types.ts';
import { NotificationBell } from '../admin/NotificationBell.tsx';
import { useTheme } from '../../hooks/useTheme.tsx';

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

export const Header: React.FC<HeaderProps> = ({ user, onNotificationsClick, onMenuClick }) => {
    const { theme, toggleTheme } = useTheme();
    const isLightMode = theme === 'professional';

    return (
        <header className="bg-card-bg/80 backdrop-blur-lg border-b border-primary/20 theme-professional:border-stone-200 sticky top-0 z-40">
            <div className="flex justify-between items-center px-4 py-3 md:px-6">
                <div className="flex items-center gap-4">
                    <button onClick={onMenuClick} className="md:hidden text-text-base p-2 -ml-2 rounded-full active:bg-white/5 flex items-center justify-center w-10 h-10">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleTheme}
                        className="flex items-center justify-center w-10 h-10 rounded-lg border border-primary/20 theme-professional:border-stone-200 bg-primary/10 text-primary hover:bg-primary/20 theme-professional:hover:bg-primary/10 transition-all"
                        title={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
                        aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
                    >
                        <span className="material-symbols-outlined text-xl">{isLightMode ? 'dark_mode' : 'light_mode'}</span>
                    </button>
                    {user && <NotificationBell user={user as any} onClick={onNotificationsClick} />}
                </div>
            </div>
        </header>
    );
};
