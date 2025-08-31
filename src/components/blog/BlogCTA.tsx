"use client";

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import { apiFetch } from '@/utils/apiFetch';

export default function BlogCTA() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const member = useMemberStore((s) => s.member);
  const fetchMember = useMemberStore((s) => s.fetchMember);
  const site = useSiteStore((s) => s.siteInfo);
  const [saving, setSaving] = useState(false);
  const hasBlog = !!member?.blogEnabled;

  const start = useCallback(async () => {
    if (!user?.user_id || !site?.id) return;
    setSaving(true);
    try {
      await apiFetch(`/api/user/${user.user_id}/blog/enable?siteId=${site.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });
      await fetchMember(user.user_id, site.id);
    } finally {
      setSaving(false);
    }
  }, [user?.user_id, site?.id, fetchMember]);

  if (!user) return null;

  return (
    <div className="p-3 border rounded-lg bg-white shadow-sm">
      {hasBlog ? null : (
        <button
          onClick={start}
          disabled={saving}
          className="text-sm bg-sage-600 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          {saving ? t('saving') : t('startYourBlog')}
        </button>
      )}
    </div>
  );
}
