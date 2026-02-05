
import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { AdminProfile, StudentProfile, CompanyProfile, Notification } from '../../types.ts';
import toast from 'react-hot-toast';

interface NotificationsCenterProps {
    user: AdminProfile | StudentProfile | CompanyProfile;
    onClose: () => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({ user, onClose }) => {
    const supabase = useSupabase();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = async () => {
        setIsLoading(true);
        const profile = user as any;
        const college = profile.college || (profile.company_name ? 'Corporate' : null);
        
        if (!college && !profile.company_name) {
            setIsLoading(false);
            return;
        }

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('recipient_role', profile.role)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (college) {
            query = query.eq('college', college);
        }

        if (profile.department) {
            query = query.eq('recipient_department', profile.department);
        }

        const { data, error } = await query;
        if (error) {
            console.error("Error fetching notifications:", error);
            toast.error("Failed to load notifications.");
        } else {
            setNotifications(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchNotifications();
    }, [user, supabase]);

    const handleMarkRead = async (id: string) => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        }
    };

    const handleMarkAllRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
        if (!error) {
            setNotifications(prev => prev.map(n => ({...n, is_read: true})));
            toast.success("All caught up!");
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in-up">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="font-display text-4xl text-primary mb-1">Notifications Center</h1>
                    <p className="text-text-muted">Stay updated with institutional broadcasts and career alerts.</p>
                </div>
                <Button 
                    variant="ghost" 
                    onClick={onClose} 
                    className="border-white/10 hover:border-red-500/50 hover:text-red-400 group flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Close
                </Button>
            </div>

            <Card glow="none" className="bg-card-bg/30 border-white/5 overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">
                        Recent Alerts
                    </p>
                    {notifications.some(n => !n.is_read) && (
                        <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-secondary hover:text-white transition-colors uppercase tracking-widest border-b border-secondary/50">
                            Mark all as read
                        </button>
                    )}
                </div>

                <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex justify-center p-12"><Spinner /></div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center opacity-30">
                            <div className="text-6xl mb-4">🔕</div>
                            <p className="font-display text-xl">Inbox is empty.</p>
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div 
                                key={n.id} 
                                onClick={() => !n.is_read && handleMarkRead(n.id)}
                                className={`p-6 transition-all duration-300 flex items-start gap-4 hover:bg-white/5 group ${
                                    !n.is_read 
                                        ? 'bg-primary/5 shadow-[inset_3px_0_0_0_rgb(var(--color-primary-rgb))]' 
                                        : 'opacity-70'
                                }`}
                            >
                                <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.is_read ? 'bg-primary shadow-[0_0_8px_#00ffff] animate-pulse' : 'bg-white/10'}`}></div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className={`text-sm md:text-base leading-relaxed ${!n.is_read ? 'text-white font-medium' : 'text-text-muted'}`}>
                                            {n.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${!n.is_read ? 'text-primary' : 'text-text-muted opacity-50'}`}>
                                            {!n.is_read ? 'Priority' : 'Read'}
                                        </span>
                                        <span className="w-1 h-1 rounded-full bg-white/10"></span>
                                        <p className="text-[10px] text-text-muted font-mono opacity-60">
                                            {new Date(n.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                {!n.is_read && (
                                    <Button 
                                        variant="ghost" 
                                        className="text-[10px] py-1 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                                    >
                                        Read
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-white/5 border-t border-white/10 text-center">
                    <p className="text-[10px] text-text-muted uppercase tracking-tighter">End of broadcast history</p>
                </div>
            </Card>

            <div className="mt-8 flex justify-center">
                <Button variant="primary" onClick={onClose} className="w-full max-w-sm shadow-primary">
                    Back to Command Center
                </Button>
            </div>
        </div>
    );
};
