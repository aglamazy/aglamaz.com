import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchPlatformDescription } from '@/firebase/admin';
import { getLocalizedDocument, normalizeLang } from '@/services/LocalizationService';
import { toRichTextDoc } from '@/utils/richText';
import { getServerT } from '@/utils/serverTranslations';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';
import { Button } from '@/components/ui/button';
import ArrowCTA from '@/components/ArrowCTA';

export const dynamic = 'force-dynamic';

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  return buildPageMetadata({
    locale,
    path: 'about',
    title: 'About FamCircle',
    description:
      'FamCircle is a private, invite-only space where families keep their story together — photos, a blog, a shared calendar and more.',
    type: 'website',
  });
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const baseLang = locale.split('-')[0]?.toLowerCase() || locale.toLowerCase();
  const t = await getServerT(baseLang);
  const isRTL = baseLang === 'he' || baseLang === 'ar';

  let platformDescription = null;
  try {
    platformDescription = await fetchPlatformDescription();
  } catch (error) {
    console.error('[about] failed to fetch platform description', error);
  }

  const normalizedLang = normalizeLang(locale) ?? baseLang;
  const platformDescriptionBase = toRichTextDoc(platformDescription, 'en');
  const platformDescriptionDoc = platformDescriptionBase
    ? getLocalizedDocument(platformDescriptionBase, normalizedLang, ['title', 'content'])
    : null;
  const platformTitle = platformDescriptionDoc?.title ?? '';
  const platformContent = platformDescriptionDoc?.content ?? '';

  return (
    <div className="bg-cream-50">
      <section className="border-b border-sage-100">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal mb-4">{t('aboutFamCircleTitle') as string}</h1>
          <p className="text-lg md:text-xl text-sage-600 leading-relaxed mb-4">
            {t('aboutFamCircleIntro') as string}
          </p>
          <p className="text-base text-sage-500 leading-relaxed">
            {t('aboutFamCirclePrivacyNote') as string}
          </p>
        </div>
      </section>

      {platformContent && (
        <section className="border-b border-sage-100 bg-gradient-to-br from-sage-50 to-cream-100">
          <div className="max-w-3xl mx-auto px-4 py-12">
            {platformTitle && (
              <h2 className="text-2xl md:text-3xl font-bold text-charcoal mb-6 text-center">{platformTitle}</h2>
            )}
            <div
              className="prose prose-sage max-w-none text-sage-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: platformContent }}
            />
          </div>
        </section>
      )}

      <section className="max-w-3xl mx-auto px-4 py-14 text-center">
        <h2 className="text-2xl font-bold text-charcoal mb-6">{t('createYourOwnSiteCtaTitle') as string}</h2>
        <Link href={`/${locale}/create-your-own`} className="inline-block">
          <Button className="group">
            {t('createYourOwnSiteCtaButton') as string}
            <ArrowCTA isRTL={isRTL} />
          </Button>
        </Link>
      </section>
    </div>
  );
}
