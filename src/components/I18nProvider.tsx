'use client';
import React, { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const htmlElement = document.documentElement;
    if (i18n.language === 'he') {
      htmlElement.dir = 'rtl';
      htmlElement.lang = 'he';
    } else {
      htmlElement.dir = 'ltr';
      htmlElement.lang = i18n.language;
    }
  }, [i18n.language]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
