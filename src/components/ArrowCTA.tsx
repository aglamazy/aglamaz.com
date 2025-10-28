import { ArrowRight, ArrowLeft } from 'lucide-react';

interface ArrowCTAProps {
  isRTL?: boolean;
  className?: string;
}

export default function ArrowCTA({ isRTL = false, className = '' }: ArrowCTAProps) {
  const baseClassName = 'w-4 h-4 transition-transform duration-200';
  const spacing = 'ms-2'; // margin-inline-start (automatically handles RTL)
  const fullClassName = className ? `${baseClassName} ${spacing} ${className}` : `${baseClassName} ${spacing}`;

  if (isRTL) {
    return (
      <ArrowLeft
        className={`${fullClassName} group-hover:-translate-x-1`}
        aria-hidden="true"
      />
    );
  }

  return (
    <ArrowRight
      className={`${fullClassName} group-hover:translate-x-1`}
      aria-hidden="true"
    />
  );
}
