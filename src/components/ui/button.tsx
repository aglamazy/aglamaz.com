import React from 'react';

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, className, ...props }, ref) => {
    const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white shadow hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
    const cls = className ? `${base} ${className}` : base;
    return (
      <button
        ref={ref}
        {...props}
        className={cls}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button'; 
