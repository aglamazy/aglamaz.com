"use client";

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

export function useLocaleSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const normalizedLocale = (i18n.language || '').split('-')[0];
  const currentLocale = SUPPORTED_LOCALES.includes(normalizedLocale) ? normalizedLocale : DEFAULT_LOCALE;

  const changeLocale = (lang: string) => {
    const targetLocale = SUPPORTED_LOCALES.includes(lang) ? lang : DEFAULT_LOCALE;
    if (i18n.language !== targetLocale) {
      i18n.changeLanguage(targetLocale);
    }

    try {
      const currentPath = pathname || '/';
      const isPrivateRoute = currentPath.startsWith('/app') || currentPath.startsWith('/admin');
      if (isPrivateRoute) {
        const params = new URLSearchParams(searchParams?.toString());
        params.set('locale', targetLocale);
        const queryString = params.toString();
        const nextUrl = queryString ? `${currentPath}?${queryString}` : currentPath;
        router.replace(nextUrl, { scroll: false });
        router.refresh();
      } else {
        const segments = currentPath.split('/').filter(Boolean);
        let nextPath = currentPath;

        if (segments.length > 0 && SUPPORTED_LOCALES.includes(segments[0])) {
          const rest = segments.slice(1).join('/');
          nextPath = `/${targetLocale}${rest ? `/${rest}` : ''}`;
        } else if (segments.length === 0) {
          nextPath = `/${targetLocale}`;
        }

        router.replace(nextPath, { scroll: false });
        router.refresh();
      }
    } catch (error) {
      console.error('[useLocaleSwitcher] failed to update locale path', error);
    }
  };

  return { currentLocale, changeLocale };
}
