"use client";
import React from "react";
import Link from 'next/link';
import { ISite } from "@/entities/Site";
import { useTranslation } from 'react-i18next';
import { AppRoute, getPath } from '@/utils/urls';
import { getPlatformName } from '@/utils/platformName';
import { getVersion } from '@/utils/version';
import { LANGUAGES } from '@/constants/languages';
import { useLocaleSwitcher } from '@/hooks/useLocaleSwitcher';

interface FooterProps {
  siteInfo: ISite;
}

export default function Footer({ siteInfo }: FooterProps) {
  const year = new Date().getFullYear();
  const { t, i18n } = useTranslation();
  const siteDisplayName = siteInfo?.name?.trim();
  const version = getVersion();
  const locale = i18n.language.split('-')[0];
  const termsHref = getPath(AppRoute.TERMS, { locale });
  const privacyHref = getPath(AppRoute.PRIVACY, { locale });
  const { currentLocale, changeLocale } = useLocaleSwitcher();

  return (
    <footer className="w-full px-4 py-6 text-center text-sm text-sage-700 border-t border-sage-200">
      <p className="mb-2">&copy; {year} {siteDisplayName}. v{version}. {t('allRightsReserved') as string}</p>
      <p className="flex items-center justify-center gap-4">
        <Link href={termsHref} className="underline hover:no-underline">
          {t('termsAndConditions')}
        </Link>
        <Link href={privacyHref} className="underline hover:no-underline">
          {t('privacyPolicy')}
        </Link>
      </p>
      <p className="mt-3 flex items-center justify-center gap-2">
        <label htmlFor="footer-language-select" className="sr-only">
          {t('changeLanguage') as string}
        </label>
        <select
          id="footer-language-select"
          value={currentLocale}
          onChange={(e) => changeLocale(e.target.value)}
          aria-label={t('changeLanguage') as string}
          className="rounded-full border border-sage-300 bg-white px-3 py-1 text-sm text-sage-700 shadow-sm hover:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-300"
        >
          {LANGUAGES.map(({ code, label, flag }) => (
            <option key={code} value={code}>
              {flag} {label}
            </option>
          ))}
        </select>
      </p>
    </footer>
  );
}
