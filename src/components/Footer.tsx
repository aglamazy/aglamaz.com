"use client";
import React from "react";
import { ISite } from "@/entities/Site";
import { useTranslation } from 'react-i18next';

interface FooterProps {
  siteInfo: ISite;
}

export default function Footer({ siteInfo }: FooterProps) {
  const year = new Date().getFullYear();
  const { t } = useTranslation();
  return (
    <footer className="w-full px-4 py-6 text-center text-sm text-sage-700 border-t border-sage-200">
      <p>&copy; {year} {siteInfo.name}. {t('allRightsReserved') as string}</p>
    </footer>
  );
}
