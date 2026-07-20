import type { Metadata } from 'next';
import PrivacyPage from './PrivacyPage';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';
import { getServerT } from '@/utils/serverTranslations';
import { adminAuth, fetchSiteInfo, initAdmin } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';

const LAST_UPDATED_ISO = '2026-07-17';

async function resolveContactEmail(locale: string): Promise<string | null> {
  try {
    const siteId = await resolveSiteId();
    if (!siteId) {
      return null;
    }

    const siteInfo = await fetchSiteInfo(siteId, locale);
    const ownerUid = siteInfo?.ownerUid;
    if (!ownerUid) {
      return null;
    }

    initAdmin();
    const userRecord = await adminAuth().getUser(ownerUid);
    return userRecord.email?.trim() || null;
  } catch (error) {
    console.error('Failed to resolve privacy contact email:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const t = await getServerT(locale);

  return buildPageMetadata({
    locale,
    path: 'privacy',
    title: t('privacyPageTitle') as string,
    description: t('privacyPageDescription') as string,
    type: 'website',
  });
}

export default async function PrivacyRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const contactEmail = await resolveContactEmail(locale);

  return <PrivacyPage contactEmail={contactEmail} lastUpdatedIso={LAST_UPDATED_ISO} />;
}
