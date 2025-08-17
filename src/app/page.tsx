'use client';

import React, {useState, useEffect, useRef} from "react";
import WelcomeHero from "../components/home/WelcomeHero";
import FamilyOverview from "../components/FamilyOverview";
import {useSiteStore} from "../store/SiteStore";
import {useUserStore} from "../store/UserStore";
import {useRouter} from "next/navigation";
import {initFirebase, auth, googleProvider} from "../firebase/client";
import {signInWithPopup, getIdToken} from "firebase/auth";
import {useTranslation} from 'react-i18next';
import { apiFetch } from '../utils/apiFetch';

export default function Home() {
    const {t} = useTranslation();
    const {user, loading, checkAuth, setUser} = useUserStore();
    const siteInfo = useSiteStore((state) => state.siteInfo);
    const familyName = siteInfo?.name || t('familyMember');
    const router = useRouter();
    const fetchedUserSiteRef = useRef<string | null>(null);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        const userId = user?.user_id;
        const siteId = siteInfo?.id;
        if (!userId || !siteId || loading) return; // מחכים לכל הנתונים

        const key = `${userId}|${siteId}`;
        if (fetchedUserSiteRef.current === key) return; // כבר רץ עבור אותו זוג

        fetchedUserSiteRef.current = key; // מסמנים שרץ
        void checkMemberStatus();
    }, [user?.user_id, siteInfo?.id, loading]);

    const checkMemberStatus = async () => {
        try {
            const site_id = siteInfo?.id;
            const response = await apiFetch(`/api/user/${user.user_id}/members/${site_id}`);

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