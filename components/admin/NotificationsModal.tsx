
import React from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import type { Notification } from '../../types.ts';

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onMarkAllRead: () => void;
    onMarkRead: (id: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ 
    isOpen, 
    onClose, 
    notifications, 
    onMarkAllRead,
    onMarkRead
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Notifications">
            <div className="flex justify-between items-center mb-6">
                <p className="text-text-muted text-sm">Tap an alert to mark it as read.</p>
                {notifications.some(n => !n.is_read) && (
                    <button onClick={onMarkAllRead} className="text-xs font-bold text-secondary hover:text-white transition-colors underline underline-offset-4">
                        Mark all as read
                    </button>
                )}
            </div>
            
            <div className="space-y-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
                {notifications.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center opacity-40">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-3xl">
                            🔕
                        </div>
                        <p className="text-text-muted font-display">Your inbox is clear.</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => !n.is_read && onMarkRead(n.id)}
                            className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer group ${
                                !n.is_read 
                                    ? 'bg-primary/10 border-primary/40 shadow-[inset_3px_0_0_0_rgb(var(--color-primary-rgb))] hover:bg-primary/20' 
                                    : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                            }`}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <p className={`text-sm leading-relaxed ${!n.is_read ? 'text-white font-medium' : 'text-text-muted'}`}>
                                    {n.message}
                                </p>
                                {!n.is_read && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-secondary flex-shrink-0 mt-1.5 shadow-[0_0_8px_orange] animate-pulse"></span>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-3">
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${!n.is_read ? 'text-primary' : 'text-text-muted opacity-50'}`}>
                                    {!n.is_read ? 'New Alert' : 'Read'}
                                </span>
                                <p className="text-[10px] text-text-muted font-mono opacity-60">
                                    {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className="mt-8 border-t border-white/10 pt-5">
                <Button variant="ghost" onClick={onClose} className="w-full border-white/10 hover:border-white/30 !text-white text-sm">
                    Back to Dashboard
                </Button>
            </div>
        </Modal>
    );
};
