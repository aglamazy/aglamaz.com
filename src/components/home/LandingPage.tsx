'use client';

import React from 'react';
import WelcomeHero from './WelcomeHero';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function LandingPage() {
  const { t } = useTranslation();
  return (
    <div>
      <WelcomeHero user={null} title={t('welcomeToFamilyCircle')} subtitle={t('stayConnected')} />
      <div className="text-center mt-8 mb-20">
        <Link href="/app" className="bg-sage-600 text-white px-6 py-2 rounded-lg">
          Get started
        </Link>
      </div>
    </div>
  );
}
