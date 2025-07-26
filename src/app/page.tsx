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

export default function Home() {
  const { user, loading, checkAuth, setUser } = useUserStore();
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const familyName = siteInfo?.name || 'Family';
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
      <WelcomeHero user={user} />
      <FamilyOverview />
    </div>
  );
}