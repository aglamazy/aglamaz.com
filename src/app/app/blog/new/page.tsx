"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/utils/apiFetch';
import EditorRich from '@/components/EditorRich';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import BlogSetupModal from '@/components/blog/BlogSetupModal';

export default function NewPostPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const fetchMember = useMemberStore((state) => state.fetchMember);
  const memberLoading = useMemberStore((state) => state.loading);
  const site = useSiteStore((state) => state.siteInfo);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [requestedMember, setRequestedMember] = useState(false);

  useEffect(() => {
    if (!requestedMember && user?.user_id && site?.id) {
      setRequestedMember(true);
      fetchMember(user.user_id, site.id);
    }
  }, [fetchMember, requestedMember, site?.id, user?.user_id]);

  useEffect(() => {
    if (!memberLoading && member && !member.blogEnabled) {
      setShowSetup(true);
    }
  }, [member, memberLoading]);

  useEffect(() => {
    if (requestedMember && !memberLoading && !member) {
      router.replace('/app/blog');
    }
  }, [member, memberLoading, requestedMember, router]);

  const handleSetupSuccess = useCallback(async () => {
    if (user?.user_id && site?.id) {
      await fetchMember(user.user_id, site.id);
    }
    setShowSetup(false);
  }, [fetchMember, site?.id, user?.user_id]);

  const handleSetupClose = useCallback(() => {
    if (!member?.blogEnabled) {
      router.replace('/app/blog');
    }
    setShowSetup(false);
  }, [member?.blogEnabled, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.user_id) return;
    setSaving(true);
    try {
      await apiFetch('/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorId: user.user_id, title, content, isPublic, lang: i18n.language })
      });
      router.push('/app/blog');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const disableActions = saving || memberLoading || showSetup;

  return (
    <>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{t('newPost')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border p-2"
              placeholder={t('title') as string}
              disabled={disableActions}
            />
            <div className={disableActions ? 'pointer-events-none opacity-60' : ''}>
              <EditorRich
                value={content}
                locale={(i18n.language || 'en').split('-')[0]}
                onChange={setContent}
              />
            </div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                disabled={disableActions}
              />
              <span>{t('public')}</span>
            </label>
            <Button type="submit" disabled={disableActions}>
              {saving ? t('saving') : t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <BlogSetupModal open={showSetup} onClose={handleSetupClose} onSuccess={handleSetupSuccess} />
    </>
  );
}
