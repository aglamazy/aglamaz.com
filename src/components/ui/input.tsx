import React from 'react';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    const base = 'w-full px-3 py-2 border border-sage-200 rounded-md focus:ring-2 focus:ring-sage-500 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed';
    const cls = className ? `${base} ${className}` : base;
    return (
      <input
        ref={ref}
        type={type}
        className={cls}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
