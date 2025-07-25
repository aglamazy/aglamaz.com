import React from 'react';

export const Card = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`rounded shadow bg-white ${className}`} {...props}>{children}</div>
);

export const CardContent = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-4 ${className}`} {...props}>{children}</div>
);

export const CardHeader = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`border-b p-4 font-bold ${className}`} {...props}>{children}</div>
);

export const CardTitle = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`text-lg ${className}`} {...props}>{children}</div>
); 