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
      <style>{`
            :root {
              --cream-50: #FEFCF8;
              --cream-100: #FDF8F0;
              --sage-50: #F7F8F6;
              --sage-100: #E8EBE6;
              --sage-200: #D1D8CC;
              --sage-300: #A8B5A0;
              --sage-400: #8B9A7B;
              --sage-500: #6B7A5E;
              --sage-600: #566249;
              --sage-700: #454F3B;
              --sage-800: #373F2F;
              --sage-900: #2C3E36;
              --charcoal: #2C3E36;
            }
            .bg-cream-50 { background-color: var(--cream-50); }
            .bg-cream-100 { background-color: var(--cream-100); }
            .bg-sage-50 { background-color: var(--sage-50); }
            .bg-sage-100 { background-color: var(--sage-100); }
            .bg-sage-600 { background-color: var(--sage-600); }
            .bg-sage-700 { background-color: var(--sage-700); }
            .text-sage-600 { color: var(--sage-600); }
            .text-sage-700 { color: var(--sage-700); }
            .text-charcoal { color: var(--charcoal); }
            .border-sage-200 { border-color: var(--sage-200); }
            .border-sage-600 { border-color: var(--sage-600); }
            .hover\\:bg-sage-700:hover { background-color: var(--sage-700); }
            .hover\\:border-sage-300:hover { border-color: var(--sage-300); }
          `}</style>
      <Header siteInfo={siteInfo!} />
      {children}
      <Modal isOpen={isOpen} onClose={close}>
        <LoginPage />
      </Modal>
    </div>
  );
}
