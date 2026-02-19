'use client';

import { useTranslation } from 'react-i18next';

const sampleDate = new Date('2025-06-15T14:30:00Z');

export default function LocaleDebug() {
  const { i18n } = useTranslation();

  const navigatorLang = navigator.language;
  const navigatorLangs = Array.from(navigator.languages);
  const resolvedLocale = new Intl.DateTimeFormat().resolvedOptions().locale;
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const i18nLang = i18n.language;

  const rows = [
    ['i18n.language', i18nLang, sampleDate.toLocaleDateString(i18nLang)],
    ['navigator.language', navigatorLang, sampleDate.toLocaleDateString(navigatorLang)],
    ['navigator.languages', navigatorLangs.join(', '), sampleDate.toLocaleDateString(navigatorLangs)],
    ['Intl resolved locale', resolvedLocale, sampleDate.toLocaleDateString(resolvedLocale)],
    ['Hard-coded "he-IL"', 'he-IL', sampleDate.toLocaleDateString('he-IL')],
    ['Hard-coded "he"', 'he', sampleDate.toLocaleDateString('he')],
    ['Hard-coded "en-US"', 'en-US', sampleDate.toLocaleDateString('en-US')],
    ['Hard-coded "en-IL"', 'en-IL', sampleDate.toLocaleDateString('en-IL')],
  ];

  return (
    <div className="bg-yellow-100 border border-yellow-400 rounded p-4 text-sm font-mono" dir="ltr">
      <div className="font-bold mb-2">TEMP: Locale Debug (sample date: 2025-06-15)</div>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="pr-4">Source</th>
            <th className="pr-4">Value</th>
            <th>Formatted Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([source, value, formatted]) => (
            <tr key={source}>
              <td className="pr-4">{source}</td>
              <td className="pr-4">{value}</td>
              <td>{formatted}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-xs text-gray-600">
        TimeZone: {timeZone}
      </div>
    </div>
  );
}
