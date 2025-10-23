import LandingPage from '@/components/home/LandingPage';
import { fetchSiteInfo } from '@/firebase/admin';
import nextI18NextConfig from '../../../next-i18next.config.js';
import { cookies, headers } from 'next/headers';

const DEFAULT_LANG =
  process.env.NEXT_DEFAULT_LANG ||
  (typeof nextI18NextConfig?.i18n?.defaultLocale === 'string'
    ? nextI18NextConfig.i18n.defaultLocale
    : 'en');

function normalizeLang(value?: string | null) {
  if (!value) return '';
  const [first] = value.split(',');
  if (!first) return '';
  return first.split('-')[0]?.trim().toLowerCase() || '';
}

function resolveBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  let siteInfo = null;
  try {
    siteInfo = await fetchSiteInfo();
  } catch (error) {
    console.error('Failed to fetch site info for home page:', error);
    throw error;
  }

  const h = headers();
  const cookieStore = cookies();

  const queryLangRaw = Array.isArray(searchParams?.lang)
    ? searchParams?.lang[0]
    : searchParams?.lang;
  const queryLang = normalizeLang(queryLangRaw?.toString());
  const cookieLang = normalizeLang(cookieStore.get('i18next')?.value || '');
  const headerLang = normalizeLang(h.get('accept-language'));

  const resolvedLang = queryLang || cookieLang || headerLang || DEFAULT_LANG;
  const baseUrl = resolveBaseUrl();

  return (
    <>
      <script
        id="__INITIAL_LANG__"
        dangerouslySetInnerHTML={{
          __html: `window.__INITIAL_LANG__=${JSON.stringify(resolvedLang)};`,
        }}
      />
      <LandingPage siteInfo={siteInfo} lang={resolvedLang} baseUrl={baseUrl} />
    </>
  );
}
