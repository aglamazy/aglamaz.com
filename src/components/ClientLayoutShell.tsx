'use client';
import React, { useEffect, useState } from "react";
import { useSiteStore } from '../store/SiteStore';
import { useUserStore } from '../store/UserStore';
import { useRouter } from "next/navigation";
import { MembershipStatus, useMemberStore } from '../store/MemberStore';
import I18nProvider from './I18nProvider';
import { useTranslation } from 'react-i18next';
import { Loader } from "../components/ui/Loader";
import I18nGate from "@/components/I18nGate";
import { landingPage } from "@/app/settings";
import { useLoginModalStore } from '@/store/LoginModalStore';
import { usePendingMemberModalStore } from '@/store/PendingMemberModalStore';
import { useNotMemberModalStore } from '@/store/NotMemberModalStore';
import { useEditUserModalStore } from '@/store/EditUserModalStore';
import { usePresentationModeStore } from '@/store/PresentationModeStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import ClientDesktopShell from '@/components/ClientDesktopShell';
import ClientMobileShell from '@/components/ClientMobileShell';

export default function ClientLayoutShell({ children }) {
  const { user, loading, logout, checkAuth } = useUserStore();
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const member = useMemberStore((state) => state.member);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isOpen: isLoginOpen, close: closeLogin, open: openLogin } = useLoginModalStore();
  const { isOpen: isPendingOpen, close: closePending, open: openPending } = usePendingMemberModalStore();
  const { isOpen: isApplyOpen, close: closeApply, open: openApply } = useNotMemberModalStore();
  const { isOpen: isEditOpen, close: closeEdit } = useEditUserModalStore();

  const { fetchMember } = useMemberStore();
  const presentationModeActive = usePresentationModeStore((state) => state.active);
  const isMobile = useIsMobile();

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

    const ensureMemberStatus = async () => {
      try {
        const status = await fetchMember(user.user_id, siteInfo.id);
        if (status === MembershipStatus.Pending) {
          openPending();
        } else if (status === MembershipStatus.NotApplied) {
          openApply();
        }
      } catch (error) {
        console.error('Failed to fetch member inside ClientLayoutShell', error);
        throw error;
      }
    };

    void ensureMemberStatus();
  }, [user?.user_id, siteInfo?.id, fetchMember, openPending, openApply]);

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
      <Loader size={24} thickness={3} text={t('loading') as string}/>
    );
  }

  return (
    <I18nProvider>
      <I18nGate>
        {isMobile ? (
          <ClientMobileShell
            t={t}
            presentationModeActive={presentationModeActive}
            isLoginOpen={isLoginOpen}
            closeLogin={closeLogin}
            isPendingOpen={isPendingOpen}
            closePending={closePending}
            isApplyOpen={isApplyOpen}
            closeApply={closeApply}
            isEditOpen={isEditOpen}
            closeEdit={closeEdit}
          />
        ) : (
          <ClientDesktopShell
            headerReady={headerReady}
            presentationModeActive={presentationModeActive}
            handleLogout={handleLogout}
            user={user}
            member={member}
            siteInfo={siteInfo}
            isLoginOpen={isLoginOpen}
            closeLogin={closeLogin}
            isPendingOpen={isPendingOpen}
            closePending={closePending}
            isApplyOpen={isApplyOpen}
            closeApply={closeApply}
            isEditOpen={isEditOpen}
            closeEdit={closeEdit}
          >
            {children}
          </ClientDesktopShell>
        )}
      </I18nGate>
    </I18nProvider>
  );
}
