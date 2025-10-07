"use client";
import React, { ChangeEvent, useMemo } from "react";
import Link from 'next/link';
import { ISite } from "@/entities/Site";
import { useTranslation } from 'react-i18next';
import { getLocalizedSiteName } from '@/utils/siteName';

interface FooterProps {
  siteInfo: ISite;
}

export default function Footer({ siteInfo }: FooterProps) {
  const year = new Date().getFullYear();
  const { t, i18n } = useTranslation();
  const rawLanguage = i18n.resolvedLanguage ?? i18n.language ?? 'he';
  const activeLanguage = rawLanguage.split('-')[0];
  const localizedName = getLocalizedSiteName(siteInfo, activeLanguage) || siteInfo.name;

  const languageOptions = useMemo(
    () => [
      { code: 'he', label: t('languageNames.he', { defaultValue: 'עברית' }) as string },
      { code: 'en', label: t('languageNames.en', { defaultValue: 'English' }) as string },
      { code: 'tr', label: t('languageNames.tr', { defaultValue: 'Türkçe' }) as string },
    ],
    [t]
  );

  const navigationItems = useMemo(
    () => [
      { href: '/blog', label: t('footer.blog', { defaultValue: 'Blog' }) as string },
      { href: '/pictures/feed', label: t('footer.photo', { defaultValue: 'Photos' }) as string },
      { href: '/calendar', label: t('footer.calendar', { defaultValue: 'Calendar' }) as string },
    ],
    [t]
  );

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextLanguage = event.target.value;
    if (nextLanguage !== activeLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  };

  return (
    <footer className="w-full border-t border-sage-200 bg-sage-50/80">
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex flex-col gap-6 rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-sage-100 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3 text-left sm:max-w-md">
            <p className="text-sm font-medium text-sage-800">
              &copy; {year} {localizedName}. {t('allRightsReserved') as string}
            </p>
            <Link
              href="/terms"
              className="text-sm font-semibold text-sage-600 underline decoration-sage-300 underline-offset-4 transition hover:text-sage-900 hover:decoration-sage-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-500"
            >
              {t('termsAndConditions')}
            </Link>
          </div>

          <div className="flex w-full flex-col gap-4 sm:max-w-xs sm:text-right">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-sage-500">
                {t('footer.language', { defaultValue: 'Language' }) as string}
              </span>
              <div className="relative">
                <select
                  id="footer-language-selector"
                  aria-label={t('footer.language', { defaultValue: 'Language' }) as string}
                  value={activeLanguage}
                  onChange={handleLanguageChange}
                  className="w-full appearance-none rounded-full border border-sage-300 bg-white px-4 py-2 pr-10 text-sm font-medium text-sage-700 shadow-sm transition focus:border-sage-500 focus:outline-none focus:ring-2 focus:ring-sage-200"
                >
                  {languageOptions.map(({ code, label }) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sage-400">
                  ▾
                </span>
              </div>
            </div>

            <nav
              aria-label={t('footer.navigation', { defaultValue: 'Footer navigation' }) as string}
              className="w-full"
            >
              <ul className="ml-auto flex w-full snap-x snap-mandatory items-center justify-end gap-3 overflow-x-auto pb-2 pr-1 text-sm sm:pb-0">
                {navigationItems.map((item) => (
                  <li key={item.href} className="snap-end">
                    <Link
                      href={item.href}
                      className="inline-flex items-center rounded-full border border-sage-300 bg-white px-4 py-2 text-sm font-semibold text-sage-700 shadow-sm transition hover:border-sage-400 hover:text-sage-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-500"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
