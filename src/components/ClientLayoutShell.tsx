'use client';
import React, { useState, useEffect } from "react";
import { useSiteStore } from '../store/SiteStore';
import { useUserStore } from '../store/UserStore';
import { useRouter } from "next/navigation";
import { useMemberStore } from '../store/MemberStore';
import Header from "./Header";
import I18nProvider from './I18nProvider';
import { useTranslation } from 'react-i18next';
import { Loader } from "../components/ui/Loader";
import I18nGate from "@/components/I18nGate";
import { landingPage } from "@/app/settings";

export default function ClientLayoutShell({ children }) {
  const { user, loading, logout, checkAuth } = useUserStore();
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const member = useMemberStore((state) => state.member);
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const { fetchMember } = useMemberStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth])

  useEffect(() => {
    if (user?.user_id && siteInfo?.id) {
      fetchMember(user.user_id, siteInfo.id);
    }
  }, [user?.user_id, siteInfo?.id, fetchMember]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const headerReady = mounted && !!siteInfo?.name;

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
        {headerReady ? (
          <Header
            user={user}
            member={member}
            onLogout={handleLogout}
            siteInfo={siteInfo}
          />
        ) : null}
        {children}
      </div>
      </I18nGate>
    </I18nProvider>
  );
}
