import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerT } from '@/utils/serverTranslations';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import { buildPageMetadata } from '@/utils/seo';
import { Button } from '@/components/ui/button';
import ArrowCTA from '@/components/ArrowCTA';

export const dynamic = 'force-dynamic';

interface CreateYourOwnPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CreateYourOwnPageProps): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  return buildPageMetadata({
    locale,
    path: 'create-your-own',
    title: 'Create Your Own Family Site',
    description:
      'Get your own private FamCircle site for your family — photos, a blog, a shared calendar and more, all in one place.',
    type: 'website',
  });
}

// Interim page: routes to the contact form so a real person can set up a new
// family site. Once famcircle#96 (self-service site-creation onboarding)
// ships, point the CTA button below at that flow instead of /contact.
export default async function CreateYourOwnPage({ params }: CreateYourOwnPageProps) {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const baseLang = locale.split('-')[0]?.toLowerCase() || locale.toLowerCase();
  const t = await getServerT(baseLang);
  const isRTL = baseLang === 'he' || baseLang === 'ar';

  return (
    <div className="bg-cream-50">
      <section className="border-b border-sage-100">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal mb-4">
            {t('createYourOwnSitePageTitle') as string}
          </h1>
          <p className="text-lg text-sage-600 leading-relaxed mb-3">
            {t('createYourOwnSiteIntro') as string}
          </p>
          <p className="text-base text-sage-500 leading-relaxed mb-8">
            {t('createYourOwnSiteInterimNote') as string}
          </p>
          <Link href={`/${locale}/contact`} className="inline-block">
            <Button className="group">
              {t('contactUs') as string}
              <ArrowCTA isRTL={isRTL} />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
