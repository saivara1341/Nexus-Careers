

import React from 'react';
import { useTheme } from '../../hooks/useTheme.tsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: 'primary' | 'secondary' | 'none';
  // style is included in HTMLAttributes
}

export const Card: React.FC<CardProps> = ({ children, className = '', glow = 'primary', style, ...props }) => {
  const { theme } = useTheme();

  const glowClass = glow === 'primary' ? 'hover:shadow-primary hover:border-primary/40' 
                  : glow === 'secondary' ? 'hover:shadow-secondary hover:border-secondary/40' 
                  : 'hover:border-white/20';

  const borderClass = theme === 'professional' 
    ? 'border border-gray-800/60 shadow-xl shadow-black/10' 
    : 'border border-white/10';
  
  return (
    <div 
      className={`bg-card-bg backdrop-blur-xl rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 ${borderClass} ${glowClass} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};