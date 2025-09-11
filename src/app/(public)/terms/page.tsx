'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import TermsEn from '@/components/legal/TermsContent.en';
import TermsHe from '@/components/legal/TermsContent.he';
import TermsTr from '@/components/legal/TermsContent.tr';

export default function TermsPage() {
  const { i18n } = useTranslation();

  const lang = (i18n.language || '').split('-')[0];
  if (!lang) {
    throw new Error('Language not detected for Terms page');
  }

  switch (lang) {
    case 'he':
      return <TermsHe />;
    case 'tr':
      return <TermsTr />;
    case 'en':
    default:
      return <TermsEn />;
  }
}
