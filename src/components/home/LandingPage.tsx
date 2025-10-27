import Link from 'next/link';
import { ArrowRight, BookOpen, Images, Link as LinkIcon, MessageCircle, Calendar } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { createPageUrl } from '../../utils/createPageUrl';
import type { ISite } from '@/entities/Site';
import { getServerT } from '@/utils/serverTranslations';
import { cleanJsonLd, stripScriptTags } from '@/utils/jsonld';
import { getPlatformName } from '@/utils/platformName';

interface PlatformDescription {
  content: string;
  title: string;
  translations: Record<string, { title: string; content: string }>;
}

interface LandingPageProps {
  siteInfo: ISite | null;
  platformDescription: PlatformDescription | null;
  lang: string;
  baseUrl: string | null;
}

function resolveIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function resolveLogo(baseUrl: string | null) {
  if (!baseUrl) return undefined;
  return `${baseUrl}/favicon.svg`;
}

export default async function LandingPage({ siteInfo, platformDescription, lang, baseUrl }: LandingPageProps) {
  const baseLang = lang.split('-')[0]?.toLowerCase() || lang.toLowerCase();
  const t = await getServerT(baseLang);
  const translations = siteInfo?.translations || {};
  const siteInfoRecord = (siteInfo ?? {}) as Record<string, unknown>;
  const siteName =
    translations[lang] ||
    translations[baseLang] ||
    siteInfo?.name ||
    getPlatformName(siteInfo);

  // Get platform description for current language
  const platformTranslation = platformDescription?.translations?.[lang] || platformDescription?.translations?.[baseLang];
  const platformTitle = platformTranslation?.title || platformDescription?.title || '';
  const platformContent = platformTranslation?.content || platformDescription?.content || '';

  const alternateNames = Array.from(
    new Set(
      Object.values(translations)
        .map((value) => (typeof value === 'string' ? value.trim() : null))
        .filter((value): value is string => Boolean(value && value !== siteName))
    )
  );
  const sameAs = Array.isArray(siteInfoRecord.sameAs)
    ? (siteInfoRecord.sameAs as unknown[])
        .filter((value): value is string => typeof value === 'string' && /^https?:\/\//.test(value))
    : [];

  const heroTitle = t('welcomeToSite', { name: siteName }) as string;
  const heroSubtitle = t('stayConnected') as string;
  const secondarySubtitle = t('createYourFamilySite') as string;

  const spotlight = [
    {
      href: '/blog',
      icon: BookOpen,
      title: t('familyBlog') as string,
      description: t('catchUpOnFamilyNews') as string,
      cta: t('openBlog') as string,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      href: '/contact',
      icon: MessageCircle,
      title: t('contactUs') as string,
      description: t('getInTouch') as string,
      cta: t('contactUs') as string,
      gradient: 'from-slate-800 to-slate-900',
    },
  ];

  const features = [
    {
      icon: Images,
      title: t('browsePhotos') as string,
      description: t('explorePhotoAlbums') as string,
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      icon: LinkIcon,
      title: t('familyLinks') as string,
      description: t('accessFamilyResources') as string,
      gradient: 'from-green-500 to-green-600',
    },
    {
      icon: Calendar,
      title: t('familyCalendar') as string,
      description: t('upcomingFamilyGatherings') as string,
      gradient: 'from-amber-500 to-amber-600',
    },
  ];

  const organization: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': baseUrl ? `${baseUrl}/#organization` : undefined,
    name: siteName,
    url: baseUrl || undefined,
    alternateName: alternateNames.length ? alternateNames : undefined,
    description: heroSubtitle,
    sameAs: sameAs.length ? sameAs : undefined,
    foundingDate: resolveIsoDate(siteInfoRecord.createdAt),
    logo: resolveLogo(baseUrl),
  };

  const website: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': baseUrl ? `${baseUrl}/#website` : undefined,
    url: baseUrl || undefined,
    name: siteName,
    alternateName: alternateNames.length ? alternateNames : undefined,
    description: heroSubtitle,
    inLanguage: baseLang,
    publisher: baseUrl ? { '@id': `${baseUrl}/#organization` } : undefined,
  };

  const structuredData = stripScriptTags(JSON.stringify([organization, website].map(cleanJsonLd)));

  return (
    <div className="bg-cream-50">
      <section className="border-b border-sage-100">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal mb-4">{heroTitle}</h1>
          <p className="text-lg md:text-xl text-sage-600 mx-auto max-w-2xl leading-relaxed">{heroSubtitle}</p>
        </div>
      </section>

      {/* Platform Description Section */}
      {platformContent && (
        <section className="border-b border-sage-100 bg-gradient-to-br from-sage-50 to-cream-100">
          <div className="max-w-4xl mx-auto px-4 py-12">
            {platformTitle && (
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal mb-6 text-center">
                {platformTitle}
              </h2>
            )}
            <div
              className="prose prose-sage max-w-none text-sage-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: platformContent }}
            />
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          {spotlight.map(({ href, icon: Icon, title, description, cta, gradient }) => (
            <Link key={href} href={href} className="block">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <div className={`w-16 h-16 bg-gradient-to-r ${gradient} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-charcoal mb-3">{title}</h3>
                  <p className="text-sage-600 mb-6 leading-relaxed">{description}</p>
                  <Button className="border-sage-200 hover:border-sage-300 hover:bg-sage-50 group">
                    {cta}
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center mt-6 mb-6 text-sage-700 font-semibold">
          {secondarySubtitle}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {features.map(({ icon: Icon, title, description, gradient }) => (
            <Card key={title} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm text-center">
              <CardContent className="p-8">
                <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-r ${gradient} flex items-center justify-center mb-6`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">{title}</h3>
                <p className="text-sage-600 leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* TODO: Add "Get Started" CTA button here */}
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </div>
  );
}
