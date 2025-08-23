'use client';

import React from "react";
import WelcomeHero from "../components/home/WelcomeHero";
import FamilyOverview from "../components/FamilyOverview";
import {useUserStore} from "../store/UserStore";
import {useTranslation} from 'react-i18next';
import { useLoginModalStore } from '@/store/LoginModalStore';

export default function Home() {
    const {t} = useTranslation();
    const {user, loading} = useUserStore();
    const openLogin = useLoginModalStore((s) => s.open);

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
            {!user && (
                <div className="text-center mt-8">
                    <p className="text-sage-700 mb-4">{t('signInToContinue')}</p>
                    <button onClick={openLogin} className="bg-sage-600 text-white px-6 py-2 rounded-lg">
                        {t('signIn')}
                    </button>
                </div>
            )}
            {user && <FamilyOverview />}
        </div>
    );
}