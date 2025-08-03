'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

const LANGS = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
];

export default function LanguageSwitcher() {
  const { i18n: i18next } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (lang: string) => {
    if (i18next.language !== lang) {
      i18n.changeLanguage(lang);
      // Optionally, reload the page to apply dir/language changes
      router.refresh();
    }
  };

  return (
    <div className="flex gap-2 justify-end items-center p-2">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`px-3 py-1 rounded border ${i18next.language === code ? 'bg-black text-white' : 'bg-white text-black'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}