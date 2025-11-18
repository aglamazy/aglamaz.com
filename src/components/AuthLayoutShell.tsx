'use client';

import { useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useSiteStore } from '@/store/SiteStore';
import type { ISite } from '@/entities/Site';

interface AuthLayoutShellProps {
  siteInfo: ISite | null;
  children: React.ReactNode;
}

export default function AuthLayoutShell({ siteInfo, children }: AuthLayoutShellProps) {
  const setSiteInfo = useSiteStore((s) => s.setSiteInfo);

  // Hydrate the store with siteInfo from server
  useEffect(() => {
    if (siteInfo) {
      setSiteInfo(siteInfo);
    }
  }, [siteInfo, setSiteInfo]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cream-50 to-sage-50">
      {siteInfo ? <Header siteInfo={siteInfo} /> : null}
      <main className="flex-1">
        {children}
      </main>
      {siteInfo ? <Footer siteInfo={siteInfo} /> : null}
    </div>
  );
}
