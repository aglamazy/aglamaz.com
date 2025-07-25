import React from 'react';

export const Badge = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={`inline-block px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs ${className}`} {...props}>{children}</span>
); 