"use client";
import React, { useEffect } from "react";
import { useSiteStore } from '../store/SiteStore';
import { useUserStore } from '../store/UserStore';
import { useMemberStore } from '../store/MemberStore';
import { useTranslation } from 'react-i18next';
import { Loader } from "../components/ui/Loader";
import Modal from '@/components/ui/Modal';
import LoginPage from '@/components/LoginPage';
import { useLoginModalStore } from '@/store/LoginModalStore';
import PendingMemberContent from '@/components/PendingMemberContent';
import { usePendingMemberModalStore } from '@/store/PendingMemberModalStore';

export default function ClientLayoutShell() {
  const { user, loading, checkAuth } = useUserStore();
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const { fetchMember, error } = useMemberStore();
  const { i18n } = useTranslation();
  const { isOpen: isLoginOpen, close: closeLogin, open: openLogin } = useLoginModalStore();
  const { isOpen: isPendingOpen, close: closePending, open: openPending } = usePendingMemberModalStore();

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
    const userId = user?.user_id;
    const siteId = siteInfo?.id;
    if (!userId || !siteId) return;

    (async () => {
      const ok = await fetchMember(userId, siteId);
      if (!ok && !error) openPending();
    })();
  }, [user?.user_id, siteInfo?.id, fetchMember, openPending, error]);

  // Ensure site info is available on the client after hydration
  useEffect(() => {
    if (!siteInfo) {
      const w = window as any;
      if (w.__SITE_INFO__) setSiteInfo(w.__SITE_INFO__);
    }
  }, [siteInfo, setSiteInfo]);

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

  if (loading) {
    return <Loader size={24} thickness={3} text="Loading" />;
  }

  return (
    <>
      <Modal isOpen={isLoginOpen} onClose={closeLogin}>
        <LoginPage />
      </Modal>
      <Modal isOpen={isPendingOpen} onClose={closePending} isClosable={false}>
        <PendingMemberContent />
      </Modal>
    </>
  );
}
