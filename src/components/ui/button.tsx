import React from 'react';

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, ...props }, ref) => (
    <button ref={ref} {...props} className={`px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 ${props.className || ''}`}>
      {children}
    </button>
  )
);
Button.displayName = 'Button'; 