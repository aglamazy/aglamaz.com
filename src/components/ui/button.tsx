import React from 'react';

type ButtonVariant = 'primary' | 'outline' | 'destructive';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const BASE_CLASSES =
  'inline-flex items-center gap-2 px-4 py-2 rounded-full shadow transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-secondary',
  outline: 'border border-sage-200 text-sage-700 bg-white hover:bg-sage-50',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = 'primary', ...props }, ref) => {
    const variantClasses = VARIANT_CLASSES[variant];
    const combined = [BASE_CLASSES, variantClasses, className].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        {...props}
        className={combined}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
