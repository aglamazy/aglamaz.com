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
import { useIsMobile } from '@/hooks/useIsMobile';
import styles from './PublicLayoutShell.module.css';

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
  const isMobile = useIsMobile();

  useEffect(() => {
    if (siteInfo) {
      setSiteInfo(siteInfo);
    }
  }, [siteInfo, setSiteInfo]);

  // Populate user (silently) so header can show initials if logged in
  useEffect(() => {
    const populateUser = async () => {
      try {
        await checkAuth();
      } catch (error) {
        // Silently fail - this is a public page, auth is optional
        console.debug('Auth check failed in PublicLayoutShell (expected for logged-out users)');
      }
    };

    void populateUser();
  }, [checkAuth]);

  // Fetch member info when user + site ready
  useEffect(() => {
    const uid = user?.user_id;
    const sid = site?.id;
    if (!uid || !sid) return;
    const loadMember = async () => {
      try {
        await fetchMember(uid, sid);
      } catch (error) {
        // Silently fail - member info is optional for public pages
        console.debug('Failed to fetch member in PublicLayoutShell (expected for non-members)');
      }
    };

    void loadMember();
  }, [user?.user_id, site?.id, fetchMember]);

  const handleLogout = async () => {
    await logout();
    router.push(landingPage);
  };

  const containerClass = isMobile ? styles.mobileContainer : styles.desktopContainer;
  const mainClass = isMobile ? styles.mobileMain : styles.desktopMain;

  return (
    <div className={containerClass}>
      {siteInfo ? (
        <Header siteInfo={siteInfo} user={user} member={member} onLogout={handleLogout} />
      ) : null}
      <main className={mainClass}>{children}</main>
      {siteInfo ? <Footer siteInfo={siteInfo} /> : null}
      <Modal isOpen={isOpen} onClose={close}>
        <LoginPage />
      </Modal>
    </div>
  );
}
