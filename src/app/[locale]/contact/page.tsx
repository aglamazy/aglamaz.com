import type { Metadata } from 'next';
import ContactForm from './ContactForm';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';
import { getServerT } from '@/utils/serverTranslations';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const t = await getServerT(locale);

  let siteName: string | undefined;
  try {
    const siteId = await resolveSiteId();
    const siteInfo = siteId ? await fetchSiteInfo(siteId, locale) : null;
    siteName = siteInfo?.name?.trim() || undefined;
  } catch {
    // Metadata is best-effort
  }

  return buildPageMetadata({
    locale,
    path: 'contact',
    title: t('contactUs') as string,
    description: siteName
      ? (t('contactPageDescriptionWithSite', { siteName }) as string)
      : (t('contactPageDescription') as string),
    siteName,
    type: 'website',
  });
}

export default function ContactPage() {
  return <ContactForm />;
}
