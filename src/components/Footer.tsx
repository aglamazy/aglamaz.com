"use client";
import React from "react";
import Link from 'next/link';
import { ISite } from "@/entities/Site";
import { useTranslation } from 'react-i18next';
import { AppRoute, getPath } from '@/utils/urls';
import { getPlatformName } from '@/utils/platformName';
import { getVersion } from '@/utils/version';

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
    </footer>
  );
}
