'use client';

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import WelcomeHero from "../components/home/WelcomeHero";
import FamilyOverview from "../components/FamilyOverview";
import { useUserStore } from "../store/UserStore";
import { useTranslation } from 'react-i18next';

export default function LandingPage() {
    const { t } = useTranslation();
    const { user, loading } = useUserStore();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.replace('/home');
        }
    }, [loading, user, router]);

    if (loading || user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <WelcomeHero user={user} title={t('welcomeToFamilyCircle')} subtitle={t('stayConnected')} />
            <FamilyOverview />
        </div>
    );
}