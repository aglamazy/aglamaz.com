'use client';

import { useTranslation } from 'react-i18next';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { he, tr, enUS } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import { forwardRef } from 'react';

// Register locales
registerLocale('he', he);
registerLocale('tr', tr);
registerLocale('en', enUS);

interface DateInputProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

// Custom input component for react-datepicker
const CustomInput = forwardRef<HTMLInputElement, any>(({ value, onClick, placeholder }, ref) => (
  <input
    type="text"
    value={value}
    onClick={onClick}
    ref={ref}
    placeholder={placeholder}
    readOnly
    className="border rounded w-full px-3 py-2 cursor-pointer"
  />
));
CustomInput.displayName = 'CustomInput';

export default function DateInput({ value, onChange, required, className = '' }: DateInputProps) {
  const { i18n } = useTranslation();

  // Parse YYYY-MM-DD into Date object
  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const handleChange = (date: Date | null) => {
    if (date) {
      // Format to YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    } else {
      onChange('');
    }
  };

  return (
    <ReactDatePicker
      selected={selectedDate}
      onChange={handleChange}
      dateFormat={i18n.language === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy'}
      locale={i18n.language}
      customInput={<CustomInput />}
      placeholderText={i18n.language === 'en' ? 'MM/DD/YYYY' : 'DD/MM/YYYY'}
      showPopperArrow={false}
      popperPlacement="bottom-start"
    />
  );
}
