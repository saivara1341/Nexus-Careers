
import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { AdminProfile, StudentProfile, CompanyProfile, Notification } from '../../types.ts';
import toast from 'react-hot-toast';

interface NotificationBellProps {
    user: AdminProfile | StudentProfile | CompanyProfile;
    onClick?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ user, onClick }) => {
    const supabase = useSupabase();
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnreadCount = async () => {
        const profile = user as any;
        const college = profile.college || (profile.company_name ? 'Corporate' : null);
        
        if (!college && !profile.company_name) return;

        let query = supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_role', profile.role)
            .eq('is_read', false);
        
        if (college) {
            query = query.eq('college', college);
        }

        if (profile.department) {
            query = query.eq('recipient_department', profile.department);
        }

        const { count, error } = await query;
        if (!error) {
            setUnreadCount(count || 0);
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        
        const profile = user as any;
        const channel = supabase.channel('notifications-bell')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
                const newNotification = payload.new as Notification;
                
                const collegeMatch = !newNotification.college || newNotification.college === profile.college;
                const roleMatch = newNotification.recipient_role === profile.role;
                const deptMatch = !newNotification.recipient_department || newNotification.recipient_department === profile.department;

                if (collegeMatch && roleMatch && deptMatch) {
                     fetchUnreadCount();
                     toast('New Alert! Tap to view.', { 
                        icon: '🔔',
                        duration: 4000,
                        position: 'top-right'
                     });
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => {
                fetchUnreadCount();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, supabase]);

    return (
        <button 
            onClick={onClick} 
            className="relative text-gray-300 hover:text-primary transition-all duration-300 p-1.5 rounded-full hover:bg-primary/10"
            aria-label="View Notifications"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
                <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold ring-2 ring-card-bg animate-bounce">
                    {unreadCount}
                </span>
            )}
        </button>
    );
};
