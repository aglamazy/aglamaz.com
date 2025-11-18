'use client';

import { useTranslation } from 'react-i18next';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { he, tr, enUS } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import { forwardRef, useMemo, useState } from 'react';

// Register locales
registerLocale('he', he);
registerLocale('tr', tr);
registerLocale('en', enUS);

interface DateInputProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  context?: 'past' | 'nearFuture';
  todayIcon?: string;
}

// Custom input component for react-datepicker
const CustomInput = forwardRef<HTMLInputElement, any>(({ value, onClick, placeholder, onChange }, ref) => (
  <input
    type="text"
    value={value}
    onClick={onClick}
    onChange={onChange}
    ref={ref}
    placeholder={placeholder}
    className="border rounded w-full px-3 py-2 cursor-text"
  />
));
CustomInput.displayName = 'CustomInput';

export default function DateInput({ value, onChange, required, className = '', context, todayIcon }: DateInputProps) {
  const { i18n, t } = useTranslation();
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<'decade' | 'year' | 'month' | 'day'>('decade');
  const [draftDecadeStart, setDraftDecadeStart] = useState<number>(() => {
    const y = value ? new Date(value + 'T00:00:00').getFullYear() : new Date().getFullYear();
    return Math.floor(y / 10) * 10;
  });
  const [draftYear, setDraftYear] = useState<number | null>(() => {
    return value ? new Date(value + 'T00:00:00').getFullYear() : null;
  });
  const [draftMonth, setDraftMonth] = useState<number | null>(() => {
    return value ? new Date(value + 'T00:00:00').getMonth() : null;
  });

  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const minYear = 1900;
  const maxYear = context === 'past' ? nowYear : context === 'nearFuture' ? nowYear + 1 : nowYear + 100;
  const minDecade = Math.floor(minYear / 10) * 10;
  const maxDecade = Math.floor(maxYear / 10) * 10;

  // Parse YYYY-MM-DD into Date object
  const selectedDate = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : null;
  const today = useMemo(() => new Date(), []);
  const isSameDay = (a?: Date | null, b?: Date | null) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const handleChange = (date: Date | null) => {
    if (date) {
      const year = Math.min(Math.max(date.getFullYear(), minYear), maxYear);
      const daysInMonth = new Date(year, date.getMonth() + 1, 0).getDate();
      const safeDay = Math.min(date.getDate(), daysInMonth);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(safeDay).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
    } else {
      onChange('');
    }
  };

  const decadeYears = useMemo(() => {
    const start = Math.min(Math.max(draftDecadeStart, minDecade), maxDecade);
    return Array.from({ length: 10 }, (_, idx) => start + idx).filter((y) => y >= minYear && y <= maxYear);
  }, [draftDecadeStart, minDecade, maxDecade, minYear, maxYear]);

  const monthLabels = useMemo(() => {
    return Array.from({ length: 12 }, (_, idx) =>
      new Date(2000, idx, 1).toLocaleString(i18n.language, { month: 'short' })
    );
  }, [i18n.language]);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    if (!next) {
      onChange('');
      return;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(next)) {
      const parsed = new Date(next + 'T00:00:00');
      if (!Number.isNaN(parsed.getTime())) {
        let year = parsed.getFullYear();
        year = Math.min(Math.max(year, minYear), maxYear);
        const month = parsed.getMonth();
        const day = Math.min(parsed.getDate(), new Date(year, month + 1, 0).getDate());
        const normalized = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(normalized);
        setDraftYear(year);
        setDraftMonth(month);
        setDraftDecadeStart(Math.floor(year / 10) * 10);
        return;
      }
    }
    onChange(next); // keep text even if invalid; submitter can correct
  };

  const applyDaySelection = (day: number) => {
    if (draftYear === null || draftMonth === null) return;
    const formatted = `${draftYear}-${String(draftMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formatted);
    setPickerOpen(false);
  };

  return (
    <div className={className}>
      <div className="flex gap-2 items-center flex-wrap justify-center">
        <button
          type="button"
          className="px-3 py-2 text-sm border rounded bg-white hover:bg-gray-50"
          onClick={() => {
            const baseYear = selectedDate?.getFullYear() ?? Math.min(maxYear, nowYear);
            setDraftYear(Math.min(Math.max(baseYear, minYear), maxYear));
            setDraftMonth(selectedDate?.getMonth() ?? null);
            setDraftDecadeStart(Math.min(Math.max(Math.floor(baseYear / 10) * 10, minDecade), maxDecade));
            setPickerStep('decade');
            setPickerOpen(true);
          }}
        >
          📅 {t('pickDateLabel', { defaultValue: 'Pick a date' }) as string}
        </button>
        <button
          type="button"
          className={`px-3 py-2 text-sm border rounded bg-white hover:bg-gray-50 ${
            selectedDate && isSameDay(selectedDate, new Date())
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : ''
          }`}
          onClick={() => {
            const today = new Date();
            const year = Math.min(Math.max(today.getFullYear(), minYear), maxYear);
            const month = today.getMonth();
            const day = today.getDate();
            const safeDay = Math.min(day, new Date(year, month + 1, 0).getDate());
            const formatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
            onChange(formatted);
            setDraftYear(year);
            setDraftMonth(month);
            setDraftDecadeStart(Math.floor(year / 10) * 10);
            setPickerOpen(false);
          }}
        >
          {todayIcon || '👶'}{' '}
          {t('today', { defaultValue: 'Today' })}
        </button>
        <div className="min-w-[120px] max-w-[150px]">
          <ReactDatePicker
            selected={selectedDate}
            onChange={handleChange}
            dateFormat={i18n.language === 'he' ? 'dd/MM/yyyy' : 'yyyy-MM-dd'}
            locale={i18n.language}
            customInput={<CustomInput onChange={handleManualInput} />}
            placeholderText={i18n.language === 'he' ? 'dd/mm/yyyy' : 'yyyy-mm-dd'}
            showPopperArrow={false}
            popperPlacement="bottom-start"
            open={false}
          />
        </div>
      </div>

      {isPickerOpen && (
        <div className="mt-2 border rounded-lg p-3 bg-white shadow-lg space-y-3">
          {pickerStep === 'decade' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">
                  {t('chooseDecade', { defaultValue: 'Choose decade' })}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-xs"
                    onClick={() => setDraftDecadeStart((d) => d - 100)}
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-xs"
                    onClick={() => setDraftDecadeStart((d) => d + 100)}
                  >
                    »
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, idx) => {
                  const raw = draftDecadeStart - 30 + idx * 10;
                  const dec = Math.min(Math.max(raw, minDecade), maxDecade);
                  return dec;
                })
                  .filter((dec, idx, arr) => arr.indexOf(dec) === idx)
                  .map((dec) => (
                    <button
                      key={dec}
                      type="button"
                      className={`px-2 py-2 text-xs border rounded ${
                        dec === draftDecadeStart ? 'border-emerald-500 text-emerald-700' : 'border-gray-200'
                      }`}
                      onClick={() => {
                        setDraftDecadeStart(dec);
                        setPickerStep('year');
                      }}
                    >
                      {dec}s
                    </button>
                  ))}
              </div>
            </div>
          )}

          {pickerStep === 'year' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="text-sm text-sage-700"
                  onClick={() => setPickerStep('decade')}
                >
                  ← {t('decadesLabel', { defaultValue: 'Decades' })}
                </button>
                <span className="font-semibold text-sm">{draftDecadeStart}–{draftDecadeStart + 9}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {decadeYears.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`px-2 py-2 text-xs border rounded ${
                      y === draftYear ? 'border-emerald-500 text-emerald-700' : 'border-gray-200'
                    }`}
                    disabled={y < minYear || y > maxYear}
                    onClick={() => {
                      setDraftYear(y);
                      setPickerStep('month');
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pickerStep === 'month' && draftYear !== null && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="text-sm text-sage-700"
                  onClick={() => setPickerStep('year')}
                >
                  ← {t('yearLabel', { defaultValue: 'Year' })}
                </button>
                <span className="font-semibold text-sm">{draftYear}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {monthLabels.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`px-2 py-2 text-xs border rounded ${
                      idx === draftMonth ? 'border-emerald-500 text-emerald-700' : 'border-gray-200'
                    }`}
                    onClick={() => {
                      setDraftMonth(idx);
                      setPickerStep('day');
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pickerStep === 'day' && draftYear !== null && draftMonth !== null && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="text-sm text-sage-700"
                  onClick={() => setPickerStep('month')}
                >
                  ← {t('monthLabel', { defaultValue: 'Month' })}
                </button>
                <span className="font-semibold text-sm">
                  {monthLabels[draftMonth]} {draftYear}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center">
                {Array.from(
                  { length: new Date(draftYear, draftMonth + 1, 0).getDate() },
                  (_, idx) => idx + 1
                ).map((day) => (
                  <button
                    key={day}
                    type="button"
                    className="px-2 py-2 text-xs border rounded border-gray-200 hover:border-emerald-500 hover:text-emerald-700"
                    onClick={() => applyDaySelection(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 text-sm border rounded"
              onClick={() => setPickerOpen(false)}
            >
              {t('close', { defaultValue: 'Close' })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
