'use client';
import React, { useState, useEffect } from "react";
import { useSiteStore } from '../store/SiteStore';
import { useUserStore } from '../store/UserStore';
import { useRouter } from "next/navigation";
import { useMemberStore } from '../store/MemberStore';
import Header from "./Header";
import I18nProvider from './I18nProvider';
import i18n from '../i18n';
import { useTranslation } from 'react-i18next';

export default function ClientLayoutShell({ children }) {
  const { user, loading, checkAuth, logout } = useUserStore();
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const member = useMemberStore((state) => state.member);
  const router = useRouter();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Hydrate Zustand store with site info from server
    try {
      const script = document.getElementById('__SITE_INFO__');
      if (script) {
        const info = JSON.parse(script.textContent || '{}');
        setSiteInfo(info);
      }
    } catch (error) {
      console.error('Failed to parse site info:', error);
      setSiteInfo({ name: 'Family' }); // fallback
    }
  }, [setSiteInfo]);

  useEffect(() => {
    console.log("LANG changed", i18n.language)
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
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      </div>
    );
  }

  if (!user) {
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
          .hover\:bg-sage-700:hover { background-color: var(--sage-700); }
          .hover\:border-sage-300:hover { border-color: var(--sage-300); }
        `}</style>
        {children}
      </div>
    );
  }

  // Strict guard: if siteInfo or siteInfo.id is missing, show fatal error
  if (!siteInfo || !siteInfo.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-red-700 font-bold text-xl">
          Site information is missing. Please reload or contact support.
        </div>
      </div>
    );
  }

  return (
    <I18nProvider>
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
        <Header user={user} member={member} onLogout={handleLogout} siteInfo={siteInfo} />
        {children}
      </div>
    </I18nProvider>
  );
}
