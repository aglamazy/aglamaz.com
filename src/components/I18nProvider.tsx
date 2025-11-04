'use client';
import React, { useEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18nInstance } from '../i18n.client';
import { DEFAULT_LOCALE, DEFAULT_RESOURCES, SUPPORTED_LOCALES } from '../i18n';
import type { Resource } from 'i18next';

interface I18nProviderProps {
  initialLocale?: string;
  resources?: Resource;
  children: React.ReactNode;
}

export default function I18nProvider({
  initialLocale,
  resources,
  children,
}: I18nProviderProps) {
  const sanitizedLocale = (initialLocale && SUPPORTED_LOCALES.includes(initialLocale)) ? initialLocale : DEFAULT_LOCALE;
  const i18nRef = useRef(
    createI18nInstance({
      locale: sanitizedLocale,
      resources: resources ?? DEFAULT_RESOURCES,
    })
  );

  useEffect(() => {
    if (!i18nRef.current.hasResourceBundle(sanitizedLocale, 'common')) {
      const bundle = (resources ?? DEFAULT_RESOURCES)[sanitizedLocale]?.common;
      if (bundle) {
        i18nRef.current.addResourceBundle(sanitizedLocale, 'common', bundle, true, true);
      }
    }
    if (i18nRef.current.language !== sanitizedLocale) {
      i18nRef.current.changeLanguage(sanitizedLocale);
    }
  }, [sanitizedLocale, resources]);

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (sanitizedLocale === 'he') {
      htmlElement.dir = 'rtl';
      htmlElement.lang = 'he';
    } else {
      htmlElement.dir = 'ltr';
      htmlElement.lang = sanitizedLocale;
    }
  }, [sanitizedLocale]);

  return <I18nextProvider i18n={i18nRef.current}>{children}</I18nextProvider>;
}
