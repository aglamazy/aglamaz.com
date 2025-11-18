import React from 'react';
import styles from './TouchSelect.module.css';

interface Option {
  value: string;
  label: string;
}

interface TouchSelectProps {
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  columns?: number;
  className?: string;
}

export default function TouchSelect({ value, options, onChange, columns = 4, className = '' }: TouchSelectProps) {
  const gridStyle = { ['--touch-select-cols' as any]: columns };

  return (
    <div className={`${styles.grid} ${className}`} style={gridStyle}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={`${styles.button} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
