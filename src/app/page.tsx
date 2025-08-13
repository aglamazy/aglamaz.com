'use client';

import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Users, Heart, LogIn, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import WelcomeHero from "../components/home/WelcomeHero";
import FamilyOverview from "../components/FamilyOverview";
import { useSiteStore } from "../store/SiteStore";
import { useUserStore } from "../store/UserStore";
import { useRouter } from "next/navigation";
import { initFirebase, auth, googleProvider } from "../firebase/client";
import { signInWithPopup, getIdToken } from "firebase/auth";
import { useTranslation } from 'react-i18next';

export default function Home() {
  const { t } = useTranslation();
  const { user, loading, checkAuth, setUser } = useUserStore();
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const familyName = siteInfo?.name || t('familyMember');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (user && !loading) {
      checkMemberStatus();
    }
  }, [user, loading]);

  const checkMemberStatus = async () => {
    try {
      const site_id = siteInfo?.id;
      const response = await fetch(`/api/user/${user.user_id}/members/${site_id}`, {
        headers: {
          'Authorization': `Bearer ${document.cookie.match(/token=([^;]*)/)?.[1] || ''}`
        }
      });

      if (!response.ok) {
        // User is not a member, redirect to pending approval
        router.push('/pending-approval');
      }
    } catch (error) {
      console.error('Failed to check member status:', error);
      // On error, redirect to pending approval as fallback
      router.push('/pending-approval');
    }
  };

  const handleLogin = async () => {
    initFirebase();
    if (auth && googleProvider) {
      const result = await signInWithPopup(auth(), googleProvider);
      const token = await getIdToken(result.user);
      document.cookie = `token=${token}; path=/`;
      
      // Update user state immediately after login
      setUser({
        name: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        uid: result.user.uid
      });
      
      router.push('/');
    } else {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen">
      <WelcomeHero user={user} title={t('welcomeToFamilyCircle')} subtitle={t('stayConnected')} />
      <FamilyOverview />
    </div>
  );
}