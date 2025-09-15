'use client';

import React from 'react';
import WelcomeHero from './WelcomeHero';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useSiteStore } from '@/store/SiteStore';
import { MessageCircle, BookOpen, Images, Link as LinkIcon, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { createPageUrl } from '../../utils/createPageUrl';

export default function LandingPage() {
  const { t } = useTranslation();
  const site = useSiteStore((s) => s.siteInfo);

  return (
    <div>
      {/* Hero: Welcome + platform */}
      <WelcomeHero
        user={null}
        title={t('welcomeToSite', { name: site?.name || '' }) as string}
        subtitle={t('poweredByFamilyCircle') as string}
        actions={[]}
      />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4">
        {/* Public content (2 boxes): Blog + Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          {/* Family Blog card - restored previous style */}
          <Link href="/blog/family" className="block">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">{t('familyBlog')}</h3>
                <p className="text-sage-600 mb-6 leading-relaxed">{t('catchUpOnFamilyNews') as string}</p>
                <Button className="border-sage-200 hover:border-sage-300 hover:bg-sage-50 group">
                  {t('openBlog')}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </CardContent>
            </Card>
          </Link>
          <Link href="/contact" className="block">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">{t('contactUs')}</h3>
                <p className="text-sage-600 mb-6 leading-relaxed">{t('getInTouch') as string}</p>
                <Button className="border-sage-200 hover:border-sage-300 hover:bg-sage-50 group">
                  {t('contactUs')}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Pitch text */}
        <div className="text-center mt-6 mb-6 text-sage-700 font-semibold">
          {t('createYourFamilySite')}
        </div>

        {/* Feature showcase (2 cards): Photos + Links (original style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Photos */}
          <Link href={createPageUrl('/pictures/feed')} className="block">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm text-center">
              <CardContent className="p-8">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center mb-6">
                  <Images className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">{t('browsePhotos')}</h3>
                <p className="text-sage-600 mb-6 leading-relaxed">{t('explorePhotoAlbums') as string}</p>
                <Button className="border-sage-200 hover:border-sage-300 hover:bg-sage-50 group">
                  {t('explore')}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </CardContent>
            </Card>
          </Link>
          {/* Links */}
          <Link href={createPageUrl('Links')} className="block">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm text-center">
              <CardContent className="p-8">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center mb-6">
                  <LinkIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">{t('familyLinks')}</h3>
                <p className="text-sage-600 mb-6 leading-relaxed">{t('accessFamilyResources') as string}</p>
                <Button className="border-sage-200 hover:border-sage-300 hover:bg-sage-50 group">
                  {t('explore')}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
