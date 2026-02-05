
import React from 'react';

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-card-bg/50 border border-white/10 rounded-lg p-6 animate-pulse h-[250px] flex flex-col">
      <div className="h-8 bg-white/10 rounded w-3/4 mb-4"></div>
      <div className="h-6 bg-white/10 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-white/5 rounded w-1/3 mb-6"></div>
      
      <div className="space-y-2 flex-grow">
        <div className="h-3 bg-white/5 rounded w-full"></div>
        <div className="h-3 bg-white/5 rounded w-full"></div>
        <div className="h-3 bg-white/5 rounded w-2/3"></div>
      </div>

      <div className="flex justify-between mt-6 pt-4 border-t border-white/5">
        <div className="h-8 bg-white/10 rounded w-20"></div>
        <div className="h-8 bg-white/10 rounded w-24"></div>
      </div>
    </div>
  );
};
