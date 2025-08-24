'use client';
import React, { useState, useEffect } from "react";
import { useSiteStore } from '../store/SiteStore';
import { useUserStore } from '../store/UserStore';
import { useRouter } from "next/navigation";
import { useMemberStore } from '../store/MemberStore';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import I18nProvider from './I18nProvider';
import { useTranslation } from 'react-i18next';
import { Loader } from "../components/ui/Loader";
import I18nGate from "@/components/I18nGate";
import { landingPage } from "@/app/settings";
import Modal from '@/components/ui/Modal';
import LoginPage from '@/components/LoginPage';
import { useLoginModalStore } from '@/store/LoginModalStore';
import PendingMemberContent from '@/components/PendingMemberContent';
import { usePendingMemberModalStore } from '@/store/PendingMemberModalStore';

export default function ClientLayoutShell({ children }) {
  const { user, loading, logout, checkAuth } = useUserStore();
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const member = useMemberStore((state) => state.member);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isOpen: isLoginOpen, close: closeLogin, open: openLogin } = useLoginModalStore();
  const { isOpen: isPendingOpen, close: closePending, open: openPending } = usePendingMemberModalStore();

  const { fetchMember } = useMemberStore();

  useEffect(() => {
    checkAuth()
      .then(() => {
        if (!useUserStore.getState().user) openLogin();
      })
      .catch((err) => {
        openLogin();
        throw err;
      });
  }, [checkAuth, openLogin]);

  useEffect(() => {
    if (!user?.user_id || !siteInfo?.id) return;

    (async () => {
      const ok = await fetchMember(user.user_id, siteInfo.id);
      if (!ok && !useMemberStore.getState().error) openPending();
    })();
  }, [user?.user_id, siteInfo?.id, fetchMember, openPending]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Ensure site info is available on the client after hydration
  useEffect(() => {
    if (!siteInfo) {
      const w = window as any;
      if (w.__SITE_INFO__) setSiteInfo(w.__SITE_INFO__);
    }
  }, [siteInfo, setSiteInfo]);

  const headerReady = mounted && !!siteInfo;

  useEffect(() => {
    const htmlElement = document.documentElement;
    if (i18n.language === 'he') {
      htmlElement.dir = 'rtl';
      htmlElement.lang = 'he';
    } else {
      htmlElement.dir = 'ltr';
      htmlElement.lang = i18n.language;
    }
  }, [i18n.language]);

  const handleLogout = async () => {
    await logout();
    router.push(landingPage);
  };

  if (loading) {
    return (
      <Loader size={24} thickness={3} text="Loading"/>
    );
  }

  return (
    <I18nProvider>
      <I18nGate>
        <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50">
          {headerReady ? (
            <Header
              user={user}
              member={member}
              onLogout={handleLogout}
              siteInfo={siteInfo}
            />
          ) : null}
          {children}
          {siteInfo ? <Footer siteInfo={siteInfo} /> : null}
          <Modal isOpen={isLoginOpen} onClose={closeLogin}>
            <LoginPage/>
          </Modal>
          <Modal isOpen={isPendingOpen} onClose={closePending} isClosable={false}>
            <PendingMemberContent/>
          </Modal>
        </div>
      </I18nGate>
    </I18nProvider>
  );
}
