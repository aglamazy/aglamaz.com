'use client';
import React, { useState, useEffect } from "react";
import { User } from "../entities/User";
import { useSiteStore } from '../store/SiteStore';
import { useRouter } from "next/navigation";

export default function ClientLayoutShell({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  React.useEffect(() => {
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

  const checkAuth = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {
      setUser(null);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
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
      {children}
    </div>
  );
} 