import React from 'react';

interface SpinnerProps {
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ className = '' }) => {
  const hasSize = /\b(w-|h-)\d+/.test(className) || /\b(w-|h-)\[/.test(className);
  const baseClasses = hasSize ? 'relative flex items-center justify-center' : 'relative w-10 h-10 flex items-center justify-center';
  
  // Use thinner border for small spinners (w-3, w-4, etc.)
  const isSmall = /\b(w|h)-[34]\b/.test(className);
  const borderClass = isSmall ? 'border-2' : 'border-4';

  return (
    <div className={`${baseClasses} ${className}`}>
      <div className={`absolute w-full h-full ${borderClass} border-primary/20 rounded-full`}></div>
      <div className={`absolute w-full h-full ${borderClass} border-primary border-t-transparent rounded-full animate-spin`}></div>
      <div className="absolute w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
    </div>
  );
};