'use client';
import React, { useEffect, useState } from "react";
import { useSiteStore } from '../store/SiteStore';
import { useUserStore } from '../store/UserStore';
import { useRouter } from "next/navigation";
import { MembershipStatus, useMemberStore } from '../store/MemberStore';
import { useTranslation } from 'react-i18next';
import { Loader } from "../components/ui/Loader";
import I18nGate from "@/components/I18nGate";
import { landingPage } from "@/app/settings";
import { useLoginModalStore } from '@/store/LoginModalStore';
import { usePendingMemberModalStore } from '@/store/PendingMemberModalStore';
import { useNotMemberModalStore } from '@/store/NotMemberModalStore';
import { useEditUserModalStore } from '@/store/EditUserModalStore';
import { usePresentationModeStore } from '@/store/PresentationModeStore';
import ClientDesktopShell from '@/components/ClientDesktopShell';
import ClientMobileShell from '@/components/ClientMobileShell';

interface ClientLayoutShellProps {
  children: React.ReactNode;
}

export default function ClientLayoutShell({ children }: ClientLayoutShellProps) {
  const { user, loading, logout, checkAuth, hydrateFromWindow: hydrateUser } = useUserStore();
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const hydrateSiteInfo = useSiteStore((state) => state.hydrateFromWindow);
  const member = useMemberStore((state) => state.member);
  const hydrateMemberInfo = useMemberStore((state) => state.hydrateFromWindow);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { isOpen: isLoginOpen, close: closeLogin, open: openLogin } = useLoginModalStore();
  const { isOpen: isPendingOpen, close: closePending, open: openPending } = usePendingMemberModalStore();
  const { isOpen: isApplyOpen, close: closeApply, open: openApply } = useNotMemberModalStore();
  const { isOpen: isEditOpen, close: closeEdit } = useEditUserModalStore();

  const { fetchMember } = useMemberStore();
  const presentationModeActive = usePresentationModeStore((state) => state.active);
  const getSiteForLocale = useSiteStore((state) => state.getSiteForLocale);
  const cacheSiteForLocale = useSiteStore((state) => state.cacheSiteForLocale);

  // Hydrate user from window on mount (before checkAuth)
  useEffect(() => {
    hydrateUser();
  }, [hydrateUser]);

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
      hydrateSiteInfo();
    }
  }, [siteInfo, hydrateSiteInfo]);

  // Fetch site info when locale changes (after initial hydration)
  useEffect(() => {
    if (!siteInfo) return; // Wait for initial hydration first

    // Check if we have cached site for this locale
    const cached = getSiteForLocale(i18n.language);
    if (cached) {
      useSiteStore.getState().setSiteInfo(cached);
      return;
    }

    // If siteInfo is already hydrated, cache it first to avoid refetch on initial mount
    if (siteInfo && !cached) {
      cacheSiteForLocale(i18n.language, siteInfo);
      return;
    }

    // Fetch localized site from API (only on actual locale change)
    const fetchLocalizedSite = async () => {
      try {
        const data = await apiFetch(`/api/site?locale=${i18n.language}`);
        cacheSiteForLocale(i18n.language, data);
      } catch (error) {
        console.error('[ClientLayoutShell] Failed to fetch localized site:', error);
      }
    };

    void fetchLocalizedSite();
  }, [i18n.language, siteInfo, getSiteForLocale, cacheSiteForLocale]);

  // Ensure member info is available on the client after hydration
  useEffect(() => {
    if (!member) {
      hydrateMemberInfo();
    }
  }, [member, hydrateMemberInfo]);

  const headerReady = mounted && !!siteInfo;

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
    <I18nGate>
        {/* Render both mobile and desktop shells, CSS controls visibility */}
        <div className="mobile-only">
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
          >
            {children}
          </ClientMobileShell>
        </div>
        <div className="desktop-only">
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
        </div>
      </I18nGate>
  );
}
