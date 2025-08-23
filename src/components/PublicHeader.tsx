'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ISite } from '@/entities/Site';

const LANGS = [
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

export default function PublicHeader({ siteInfo }: { siteInfo: ISite }) {
  const { i18n } = useTranslation();
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  const handleLangChange = (lang: string) => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    setIsLangMenuOpen(false);
  };

  const menuPosition = i18n.language === 'he' ? 'left-0' : 'right-0';

  return (
    <header className="w-full flex items-center justify-between px-4 py-2 bg-white shadow-sm sticky top-0 z-50">
      <div className="text-xl font-semibold text-sage-700">
        {siteInfo.name}
      </div>
      <div className="relative">
        <button
          onClick={() => setIsLangMenuOpen(v => !v)}
          className="h-8 w-8 rounded-full flex items-center justify-center text-xl bg-gray-100 hover:bg-gray-200 border border-gray-300"
          aria-label="Change language"
        >
          {LANGS.find(l => l.code === i18n.language)?.flag || '🌐'}
        </button>
        {isLangMenuOpen && (
          <div className={`language-menu ${menuPosition}`}>
            <div className="py-1 flex flex-col">
              {LANGS.map(({ code, label, flag }) => (
                <button
                  key={code}
                  onClick={() => handleLangChange(code)}
                  className={`language-menu-item ${i18n.language === code ? 'font-bold' : ''}`}
                >
                  <span>{flag}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

