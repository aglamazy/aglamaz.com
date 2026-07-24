"use client";
import React from "react";
import Link from 'next/link';
import { ISite } from "@/entities/Site";
import { useTranslation } from 'react-i18next';
import { getPlatformName } from '@/utils/platformName';
import { getVersion } from '@/utils/version';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

interface FooterProps {
  siteInfo: ISite;
}

export default function Footer({ siteInfo }: FooterProps) {
  const year = new Date().getFullYear();
  const { t, i18n } = useTranslation();
  const siteDisplayName = siteInfo?.name?.trim();
  const version = getVersion();

  const normalizedLocale = (i18n.language || '').split('-')[0];
  const currentLocale = SUPPORTED_LOCALES.includes(normalizedLocale) ? normalizedLocale : DEFAULT_LOCALE;

  return (
    <footer className="w-full px-4 py-6 text-center text-sm text-sage-700 border-t border-sage-200">
      <p className="mb-2">&copy; {year} {siteDisplayName}. v{version}. {t('allRightsReserved') as string}</p>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href={`/${currentLocale}/about`} className="underline hover:no-underline">
          {t('aboutFamCircleTitle')}
        </Link>
        <Link href={`/${currentLocale}/create-your-own`} className="underline hover:no-underline">
          {t('createYourOwnSiteCtaButton')}
        </Link>
        <Link href="/terms" className="underline hover:no-underline">
          {t('termsAndConditions')}
        </Link>
      </p>
    </footer>
  );
}
