'use client';
import React, { useEffect, useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18nInstance } from '../i18n.client';
import { DEFAULT_LOCALE, DEFAULT_RESOURCES, SUPPORTED_LOCALES } from '../i18n';
import type { Resource } from 'i18next';

interface I18nProviderProps {
  initialLocale?: string;
  resolvedLocale?: string;
  resources?: Resource;
  children: React.ReactNode;
}

export default function I18nProvider({
  initialLocale,
  resolvedLocale,
  resources,
  children,
}: I18nProviderProps) {
  const normalizedInitial = initialLocale?.toLowerCase();
  const normalizedBase = normalizedInitial?.split('-')[0];
  const sanitizedLocale =
    normalizedBase && SUPPORTED_LOCALES.includes(normalizedBase)
      ? normalizedBase
      : DEFAULT_LOCALE;
  const htmlLocale = (() => {
    if (!resolvedLocale) {
      return sanitizedLocale;
    }
    const normalizedResolved = resolvedLocale.toLowerCase();
    const resolvedBase = normalizedResolved.split('-')[0];
    return resolvedBase === sanitizedLocale ? resolvedLocale : sanitizedLocale;
  })();
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
    } else {
      htmlElement.dir = 'ltr';
    }
    htmlElement.lang = htmlLocale;
  }, [sanitizedLocale, htmlLocale]);

  return <I18nextProvider i18n={i18nRef.current}>{children}</I18nextProvider>;
}
