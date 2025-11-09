"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import BlogSetupModal from './BlogSetupModal';

export default function BlogCTA() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const member = useMemberStore((s) => s.member);
  const fetchMember = useMemberStore((s) => s.fetchMember);
  const site = useSiteStore((s) => s.siteInfo);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const hasBlog = !!member?.blogEnabled;

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshMember = useCallback(async () => {
    if (!user?.user_id || !site?.id) return;
    await fetchMember(user.user_id, site.id);
  }, [fetchMember, site?.id, user?.user_id]);

  const handleSuccess = useCallback(async () => {
    await refreshMember();
    setOpen(false);
  }, [refreshMember]);

  // Prevent hydration mismatch
  if (!mounted) return null;

  if (!user) return null;

  return (
    <div className="p-3 border rounded-lg bg-white shadow-sm">
      {hasBlog ? null : (
        <>
          <button
            onClick={() => setOpen(true)}
            className="text-sm bg-sage-600 text-white px-3 py-1 rounded"
          >
            {t('startYourBlog')}
          </button>
          <BlogSetupModal
            open={open}
            onClose={() => setOpen(false)}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  );
}
