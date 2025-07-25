'use client';

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
    try {
      initFirebase(); // Ensure Firebase is initialized
      if (auth && googleProvider) {
        const result = await signInWithPopup(auth(), googleProvider);
        const token = await getIdToken(result.user);
        document.cookie = `token=${token}; path=/`;
        router.push('/private');
      } else {
        console.log('No auth or google provider');
        // Fallback: just navigate
        router.push('/private');
      }
    } catch (error) {
      console.error(error);
      alert('Login failed. Please try again.');
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full"
        >
          <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-sm p-8">
            <CardContent className="text-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="w-20 h-20 bg-gradient-to-br from-sage-600 to-sage-700 rounded-full flex items-center justify-center mx-auto mb-8"
              >
                <Users className="w-10 h-10 text-white" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <h1 className="text-4xl font-extrabold text-charcoal mb-3">{familyName}</h1>
                <p className="text-lg text-sage-700 mb-8 leading-relaxed">
                  Welcome to our family portal where memories are shared and connections are cherished.
                </p>
                <Button
                  onClick={handleLogin}
                  className="bg-sage-700 mx-auto hover:bg-sage-800 text-white px-6 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 shadow transition"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Enter Family Portal</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="mt-8 pt-8 border-t border-sage-200"
              >
                <div className="flex items-center justify-center text-sage-600">
                  <Heart className="w-4 h-4 mr-2" />
                  <span className="text-sm">Made with love for our family</span>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <WelcomeHero user={user} />
      <FamilyOverview />
    </div>
  );
}