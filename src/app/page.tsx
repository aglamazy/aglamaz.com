'use client';

import { redirect } from 'next/navigation';

import React, { useState, useEffect } from "react";
import { User } from "../entities/User";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Users, Heart, LogIn, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import WelcomeHero from "../components/home/WelcomeHero";
import FamilyOverview from "../components/FamilyOverview";
import { useSiteStore } from "../store/SiteStore";
import { useRouter } from "next/navigation";
import { initFirebase, auth, googleProvider } from "../firebase/client";
import { signInWithPopup, getIdToken } from "firebase/auth";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const familyName = siteInfo?.name || 'Family';
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {
      setUser(null);
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    initFirebase();
    if (auth && googleProvider) {
      const result = await signInWithPopup(auth(), googleProvider);
      const token = await getIdToken(result.user);
      document.cookie = `token=${token}; path=/`;
      router.push('/');
    } else {
      router.push('/');
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
    redirect('/login');
  }

  return (
    <div className="min-h-screen">
      <WelcomeHero user={user} />
      <FamilyOverview />
    </div>
  );
}