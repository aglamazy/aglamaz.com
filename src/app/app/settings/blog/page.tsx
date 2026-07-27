"use client";

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemberStore } from '@/store/MemberStore';
import { useUserStore } from '@/store/UserStore';
import { useSiteStore } from '@/store/SiteStore';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';

export default function BlogSettingsPage() {
  const { t } = useTranslation();
  const member = useMemberStore((state) => state.member);
  const fetchMember = useMemberStore((state) => state.fetchMember);
  const memberLoading = useMemberStore((state) => state.loading);
  const { user } = useUserStore();
  const site = useSiteStore((state) => state.siteInfo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [bio, setBio] = useState('');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const [bioTouched, setBioTouched] = useState(false);

  useEffect(() => {
    if (!requested && user?.user_id && site?.id) {
      setRequested(true);
      fetchMember(user.user_id, site.id);
    }
  }, [fetchMember, requested, site?.id, user?.user_id]);

  useEffect(() => {
    if (!bioTouched) {
      setBio(member?.blogBio || '');
    }
  }, [member?.blogBio, bioTouched]);

  const saveBio = useCallback(async () => {
    if (!user?.user_id || !site?.id) return;
    setBioSaving(true);
    setError(null);
    try {
      await apiFetch(ApiRoute.SITE_PROFILE, {
        method: 'PUT',
        body: { blogBio: bio },
      });
      await fetchMember(user.user_id, site.id);
      setBioTouched(false);
      setBioSaved(true);
      setTimeout(() => setBioSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update blog settings';
      setError(message);
    } finally {
      setBioSaving(false);
    }
  }, [bio, fetchMember, site?.id, user?.user_id]);

  const toggleBlog = useCallback(async (enabled: boolean) => {
    if (!user?.user_id || !site?.id) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(ApiRoute.USER_BLOG_ENABLE, {
        method: 'POST',
        pathParams: { userId: user.user_id },
        queryParams: { siteId: site.id },
        body: { enabled },
      });
      await fetchMember(user.user_id, site.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update blog settings';
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [fetchMember, site?.id, user?.user_id]);

  const hasBlog = Boolean(member?.blogEnabled);
  const slug = member?.blogHandle || '';

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{t('blogSettingsTitle', { defaultValue: 'Blog settings' })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <div className="text-sm text-gray-600">{t('blogSlugLabel', { defaultValue: 'Blog slug' })}</div>
          <code className="mt-1 inline-block rounded bg-gray-100 px-2 py-1 text-sm text-gray-800">{slug || t('blogSlugNotSet', { defaultValue: 'Not set' })}</code>
          <p className="mt-2 text-xs text-gray-500">
            {t('blogSlugLocked', { defaultValue: 'Your slug is permanent once created.' })}
          </p>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            {hasBlog
              ? t('blogStatusEnabled', { defaultValue: 'Your blog is enabled.' })
              : t('blogStatusDisabled', { defaultValue: 'Your blog is currently disabled.' })}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggleBlog(false)}
              disabled={saving || memberLoading || !hasBlog}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving && hasBlog ? t('saving') : t('disableBlog', { defaultValue: 'Disable blog' })}
            </button>
            {!hasBlog && (
              <span className="text-xs text-gray-500">
                {t('enableBlogFromCTA', { defaultValue: 'Enable your blog from the blog page.' })}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="blog-bio" className="text-sm text-gray-600">
            {t('blogBioLabel', { defaultValue: 'Public blog bio' })}
          </label>
          <textarea
            id="blog-bio"
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
              setBioTouched(true);
            }}
            maxLength={280}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder={t('blogBioPlaceholder', { defaultValue: 'A short line shown at the top of your public blog…' }) as string}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveBio}
              disabled={bioSaving || !bioTouched}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {bioSaving ? t('saving') : bioSaved ? t('saved', { defaultValue: 'Saved!' }) : t('save')}
            </button>
            <span className="text-xs text-gray-500">{bio.length}/280</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
