'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import type { AnniversaryEvent, AnniversaryType } from '@/entities/Anniversary';

interface EventSearchBoxProps {
  /** Jump the calendar to the picked event's month and highlight it - never opens the edit form directly. */
  onSelect: (event: AnniversaryEvent) => void;
}

const TYPE_ICON: Record<AnniversaryType, string> = {
  birthday: '🎂',
  wedding: '💍',
  death: '🕯️',
  other: '⭐',
};

function formatResultDate(event: AnniversaryEvent, locale: string): string {
  const year = (event as any).originalYear ?? event.year;
  const month = (event as any).originalMonth ?? event.month;
  const day = (event as any).originalDay ?? event.day;
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(year, month, day),
  );
}

export default function EventSearchBox({ onSelect }: EventSearchBoxProps) {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnniversaryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    setActive(false);
    setQuery('');
    setResults([]);
  };

  useEffect(() => {
    if (active) {
      inputRef.current?.focus();
    }
  }, [active]);

  // Debounced search across every event on the site - not just the visible month.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await apiFetch<{ events: AnniversaryEvent[] }>(ApiRoute.SITE_ANNIVERSARIES_SEARCH, {
          queryParams: { q: trimmed },
        });
        setResults(data.events || []);
        setHighlightedIndex(0);
      } catch (e) {
        console.error('[EventSearchBox] search failed', e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  // Click outside collapses back to the icon.
  useEffect(() => {
    if (!active) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [active]);

  const pick = (event: AnniversaryEvent) => {
    onSelect(event);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlightedIndex]) pick(results[highlightedIndex]);
    }
  };

  if (!active) {
    return (
      <button
        type="button"
        aria-label={t('searchEvents')}
        onClick={() => setActive(true)}
        className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <Search size={16} />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="flex items-center border rounded-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 gap-2">
        <Search size={16} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('searchEventPlaceholder')}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm"
        />
        <button type="button" aria-label={t('close')} onClick={close} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      {query.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-3 text-sm text-gray-500">…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500">{t('searchNoResults', { query })}</div>
          ) : (
            results.map((event, i) => (
              <button
                key={event.id}
                type="button"
                onClick={() => pick(event)}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-start text-sm ${
                  i === highlightedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
                }`}
              >
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <span className="w-7 h-7 rounded-full flex items-center justify-center bg-[#e3ede6] flex-shrink-0 text-sm">
                    {TYPE_ICON[event.type]}
                  </span>
                )}
                <span className="flex-1 min-w-0 truncate">{event.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatResultDate(event, i18n.language)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
