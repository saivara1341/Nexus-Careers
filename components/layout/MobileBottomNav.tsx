
import React from 'react';

export interface NavItemProps {
    id: string;
    label: string;
    mobileLabel?: string;
    icon?: React.ReactNode;
}

interface MobileBottomNavProps {
    items: NavItemProps[];
    activeItem: string;
    onItemClick: (id: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ items, activeItem, onItemClick }) => {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card-bg/95 backdrop-blur-lg border-t border-primary/20 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] safe-area-pb">
            <div className="flex justify-around items-center h-16 px-1">
                {items.map((item) => {
                    const isActive = activeItem === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onItemClick(item.id)}
                            className={`flex flex-col items-center justify-center transition-all duration-300 flex-1 h-full relative group ${
                                isActive ? 'text-primary' : 'text-text-muted hover:text-text-base'
                            }`}
                        >
                            {isActive && (
                                <div className="absolute -top-[1px] w-8 h-[2px] bg-primary shadow-[0_0_10px_#00ffff]" />
                            )}
                            <div className={`mb-1 transition-transform duration-300 ${isActive ? '-translate-y-1 scale-110' : 'group-hover:-translate-y-0.5'}`}>
                                {item.icon}
                            </div>
                            <span className={`text-[10px] font-display uppercase tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100 font-bold' : 'opacity-70'}`}>
                                {item.mobileLabel || item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
