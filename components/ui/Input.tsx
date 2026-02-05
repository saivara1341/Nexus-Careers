
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
  endAdornment?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, className = '', endAdornment, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="block text-primary font-display text-sm font-bold uppercase mb-2 tracking-tight">{label}</label>}
      <div className="relative">
        <input
          ref={ref}
          className={`w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary theme-gamified:focus:shadow-primary focus:border-transparent transition-all duration-300 ${endAdornment ? 'pr-12' : ''} ${className}`}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {endAdornment}
          </div>
        )}
      </div>
    </div>
  );
});
