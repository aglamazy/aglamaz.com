'use client';

import React from "react";
import WelcomeHero from "../components/home/WelcomeHero";
import FamilyOverview from "../components/FamilyOverview";
import {useUserStore} from "../store/UserStore";
import {useTranslation} from 'react-i18next';

export default function Home() {
    const {t} = useTranslation();
    const {user, loading} = useUserStore();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <WelcomeHero user={user} title={t('welcomeToFamilyCircle')} subtitle={t('stayConnected')}/>
            <FamilyOverview/>
        </div>
    );
}