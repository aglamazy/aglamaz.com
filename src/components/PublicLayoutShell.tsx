'use client';

import React, { useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Modal from '@/components/ui/Modal';
import LoginPage from '@/components/LoginPage';
import { useLoginModalStore } from '@/store/LoginModalStore';
import { useSiteStore } from '@/store/SiteStore';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useRouter } from 'next/navigation';
import { landingPage } from '@/app/settings';
import type { ISite } from '@/entities/Site';

interface PublicLayoutShellProps {
  siteInfo: ISite | null;
  children: React.ReactNode;
}

export default function PublicLayoutShell({ siteInfo, children }: PublicLayoutShellProps) {
  const { isOpen, close } = useLoginModalStore();
  const setSiteInfo = useSiteStore((s) => s.setSiteInfo);
  const site = useSiteStore((s) => s.siteInfo);
  const { user, checkAuth, logout } = useUserStore();
  const member = useMemberStore((s) => s.member);
  const fetchMember = useMemberStore((s) => s.fetchMember);
  const router = useRouter();

  useEffect(() => {
    if (siteInfo) {
      setSiteInfo(siteInfo);
    }
  }, [siteInfo, setSiteInfo]);

  // Populate user (silently) so header can show initials if logged in
  useEffect(() => {
    checkAuth().catch(() => {});
  }, [checkAuth]);

  // Fetch member info when user + site ready
  useEffect(() => {
    const uid = user?.user_id;
    const sid = site?.id;
    if (!uid || !sid) return;
    fetchMember(uid, sid).catch(() => {});
  }, [user?.user_id, site?.id, fetchMember]);

  const handleLogout = async () => {
    await logout();
    router.push(landingPage);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-cream-50 to-sage-50">
      <Header siteInfo={siteInfo!} user={user} member={member} onLogout={handleLogout} />
      <main className="flex-1 w-full mx-auto max-w-[1600px] px-2 sm:px-4">
        {children}
      </main>
      <Footer siteInfo={siteInfo!} />
      <Modal isOpen={isOpen} onClose={close}>
        <LoginPage />
      </Modal>
    </div>
  );
}
