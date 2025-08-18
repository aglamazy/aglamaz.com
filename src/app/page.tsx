'use client';

import React, {useState, useEffect, useRef} from "react";
import WelcomeHero from "../components/home/WelcomeHero";
import FamilyOverview from "../components/FamilyOverview";
import {useSiteStore} from "../store/SiteStore";
import {useUserStore} from "../store/UserStore";
import {useRouter} from "next/navigation";
import {useTranslation} from 'react-i18next';
import { apiFetch } from '../utils/apiFetch';

export default function Home() {
    const {t} = useTranslation();
    const {user, loading,setUser} = useUserStore();
    const siteInfo = useSiteStore((state) => state.siteInfo);
    const router = useRouter();

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
            <WelcomeHero user={user} title={t('welcomeToFamilyCircle')} subtitle={t('stayConnected')}/>
            <FamilyOverview/>
        </div>
    );
}