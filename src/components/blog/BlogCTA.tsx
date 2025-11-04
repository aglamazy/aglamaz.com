"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import BlogSetupModal from './BlogSetupModal';

export default function BlogCTA() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const member = useMemberStore((s) => s.member);
  const fetchMember = useMemberStore((s) => s.fetchMember);
  const site = useSiteStore((s) => s.siteInfo);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasBlog = !!member?.blogEnabled;

  useEffect(() => {
    setMounted(true);
  }, []);

  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleSuccess = useCallback(async (blogHandle: string) => {
    if (!user?.user_id || !site?.id) return;

    // Refresh member data
    await fetchMember(user.user_id, site.id);

    // Close modal and redirect to /app/blog
    setShowModal(false);
    router.push('/app/blog');
  }, [user?.user_id, site?.id, fetchMember, router]);

  // Prevent hydration mismatch
  if (!mounted) return null;

  if (!user || !site?.id) return null;

  // Generate suggested handle from email address (before @)
  const slugify = (input: string): string => {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || 'user';
  };

  const suggestedHandle = member?.email
    ? slugify(member.email.split('@')[0])
    : user?.email
    ? slugify((user.email as string).split('@')[0])
    : 'user';

  return (
    <>
      <div className="p-3 border rounded-lg bg-white shadow-sm">
        {hasBlog ? null : (
          <button
            onClick={openModal}
            className="text-sm bg-sage-600 text-white px-3 py-1 rounded disabled:opacity-50"
          >
            {t('startYourBlog')}
          </button>
        )}
      </div>

      <BlogSetupModal
        isOpen={showModal}
        onClose={closeModal}
        onSuccess={handleSuccess}
        userId={user.user_id}
        siteId={site.id}
        suggestedHandle={suggestedHandle}
      />
    </>
  );
}
