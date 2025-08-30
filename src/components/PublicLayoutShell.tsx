'use client';

import React, { useEffect } from 'react';
import Header from '@/components/Header';
import Modal from '@/components/ui/Modal';
import LoginPage from '@/components/LoginPage';
import { useLoginModalStore } from '@/store/LoginModalStore';
import { useSiteStore } from '@/store/SiteStore';
import type { ISite } from '@/entities/Site';

interface PublicLayoutShellProps {
  siteInfo: ISite | null;
  children: React.ReactNode;
}

export default function PublicLayoutShell({ siteInfo, children }: PublicLayoutShellProps) {
  const { isOpen, close } = useLoginModalStore();
  const setSiteInfo = useSiteStore((s) => s.setSiteInfo);

  useEffect(() => {
    if (siteInfo) {
      setSiteInfo(siteInfo);
    }
  }, [siteInfo, setSiteInfo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50">
      <Header siteInfo={siteInfo!} />
      <main className="w-full mx-auto max-w-[1600px] px-2 sm:px-4">
        {children}
      </main>
      <Modal isOpen={isOpen} onClose={close}>
        <LoginPage />
      </Modal>
    </div>
  );
}
