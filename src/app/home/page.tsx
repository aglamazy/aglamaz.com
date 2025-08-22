'use client';

import React from 'react';
import WelcomeHero from '../../components/home/WelcomeHero';
import FamilyOverview from '../../components/FamilyOverview';
import { useUserStore } from '../../store/UserStore';

export default function MemberHome() {
  const { user, loading } = useUserStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
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

