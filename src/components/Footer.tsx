"use client";
import React from "react";
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
  const localizedName = getLocalizedSiteName(siteInfo, i18n.language);

  return (
    <footer className="w-full px-4 py-6 text-center text-sm text-sage-700 border-t border-sage-200">
      <p className="mb-2">&copy; {year} {localizedName || siteInfo.name}. {t('allRightsReserved') as string}</p>
      <p>
        <Link href="/terms" className="underline hover:no-underline">
          {t('termsAndConditions')}
        </Link>
      </p>
    </footer>
  );
}
