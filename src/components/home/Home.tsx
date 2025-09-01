'use client';

import React, { useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import WelcomeHero from "./WelcomeHero";
import FamilyOverview from "../FamilyOverview";
import { useMemberStore } from "@/store/MemberStore";
import { useSiteStore } from "@/store/SiteStore";
import { apiFetch } from "@/utils/apiFetch";
import { useUserStore } from "@/store/UserStore";
import { useTranslation } from 'react-i18next';
import { useLoginModalStore } from '@/store/LoginModalStore';

export default function Home() {
    const { t } = useTranslation();
    const { user, loading } = useUserStore();
    const member = useMemberStore((s) => s.member);
    const site = useSiteStore((s) => s.siteInfo);
    const openLogin = useLoginModalStore((s) => s.open);
    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams.get('login') === '1') {
            openLogin();
        }
    }, [searchParams, openLogin]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <WelcomeHero user={user} title={t('welcomeToFamilyCircle')} subtitle={t('stayConnected')} />
            {!user && (
                <div className="text-center mt-8">
                    <p className="text-sage-700 mb-4">{t('signInToContinue')}</p>
                    <button onClick={openLogin} className="bg-sage-600 text-white px-6 py-2 rounded-lg">
                        {t('signIn')}
                    </button>
                </div>
            )}
            {user && member && !member.blogEnabled && (
              <div className="max-w-3xl mx-auto mt-6 px-4">
                <div className="bg-sage-50 border border-sage-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sage-800">{t('startYourBlog')}</div>
                    <div className="text-sage-600 text-sm">{t('startYourBlogDesc')}</div>
                  </div>
                  <button
                    className="bg-sage-600 text-white px-4 py-2 rounded-lg"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/user/${user.user_id}/blog/enable?siteId=${site?.id}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ enabled: true })
                        });
                        const fetchMember = useMemberStore.getState().fetchMember;
                        if (user?.user_id && site?.id) await fetchMember(user.user_id, site.id);
                      } catch (e) {
                        console.error(e);
                        throw e;
                      }
                    }}
                  >
                    {t('start')}
                  </button>
                </div>
              </div>
            )}
            {user && <FamilyOverview />}
        </div>
    );
}
