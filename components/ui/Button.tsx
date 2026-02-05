
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  // Removed text-lg from baseStyles. Text size should now be controlled by className or inherited.
  // Adjusted default padding to be more compact.
  const baseStyles = 'font-display px-4 py-1.5 rounded-md transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background active:scale-95 hover:-translate-y-0.5 whitespace-nowrap overflow-hidden flex items-center justify-center leading-none';
  
  // Set text color to black for primary/secondary buttons as requested.
  const textColor = variant === 'ghost' ? 'text-primary' : 'text-black';

  const variantStyles = {
    primary: `bg-primary hover:bg-primary/80 shadow-md theme-gamified:hover:shadow-primary ${textColor}`,
    secondary: `bg-secondary hover:bg-secondary/80 shadow-md theme-gamified:hover:shadow-secondary ${textColor}`,
    ghost: 'bg-transparent border-2 border-primary text-primary hover:bg-primary hover:text-white theme-gamified:hover:text-black',
  };

  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};
