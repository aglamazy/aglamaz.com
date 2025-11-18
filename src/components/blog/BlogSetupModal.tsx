"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/ui/Modal';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useSiteStore } from '@/store/SiteStore';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { normalizeSlug } from '@/utils/slug';

interface BlogSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (slug: string) => void;
}

const MIN_SLUG_LENGTH = 3;

export default function BlogSetupModal({ open, onClose, onSuccess }: BlogSetupModalProps) {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const member = useMemberStore((state) => state.member);
  const fetchMember = useMemberStore((state) => state.fetchMember);
  const site = useSiteStore((state) => state.siteInfo);
  const previewBase = typeof window !== 'undefined' ? window.location.origin : 'https://aglamaz.com';

  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestion = useMemo(() => {
    if (member?.blogHandle) {
      return normalizeSlug(member.blogHandle);
    }

    const candidates = [
      member?.email?.split('@')[0],
      user?.email?.split('@')[0],
      member?.displayName,
      member?.firstName,
      user?.name,
      user?.user_id,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeSlug(candidate || '', '');
      if (normalized) {
        return normalized;
      }
    }

    return normalizeSlug(user?.user_id || '');
  }, [member?.blogHandle, member?.displayName, member?.email, member?.firstName, user?.email, user?.name, user?.user_id]);

  useEffect(() => {
    if (open) {
      setSlug(suggestion);
      setStatus('idle');
      setStatusMessage(null);
    } else {
      setSlug('');
      setStatus('idle');
      setStatusMessage(null);
      setSubmitting(false);
    }
  }, [open, suggestion]);

  useEffect(() => {
    if (!open) return;
    if (!slug) {
      setStatus('idle');
      setStatusMessage(t('blogSlugRequired', { defaultValue: 'Choose a slug to continue' }) as string);
      return;
    }

    if (slug.length < MIN_SLUG_LENGTH) {
      setStatus('unavailable');
      setStatusMessage(
        t('blogSlugTooShort', {
          defaultValue: 'Slug must be at least {{count}} characters',
          count: MIN_SLUG_LENGTH,
        }) as string,
      );
      return;
    }

    if (!site?.id || !user?.user_id) {
      setStatus('error');
      setStatusMessage(t('missingContext', { defaultValue: 'Missing site information' }) as string);
      return;
    }

    const currentHandle = member?.blogHandle ? normalizeSlug(member.blogHandle) : null;
    if (currentHandle && currentHandle === slug) {
      setStatus('available');
      setStatusMessage(t('blogSlugLocked', { defaultValue: 'This is your blog slug' }) as string);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setStatus('checking');
    setStatusMessage(t('blogSlugChecking', { defaultValue: 'Checking availability…' }) as string);

    const timeout = setTimeout(async () => {
      try {
        const data = await apiFetch<{ slug: string; available: boolean }>(
          ApiRoute.USER_BLOG_REGISTER,
          {
            method: 'GET',
            signal: controller.signal,
            pathParams: { userId: user.user_id },
            queryParams: { siteId: site.id, slug },
          },
        );
        if (cancelled) return;
        setSlug(data.slug);
        if (data.available) {
          setStatus('available');
          setStatusMessage(t('blogSlugAvailable', { defaultValue: 'Great! This slug is available.' }) as string);
        } else {
          setStatus('unavailable');
          setStatusMessage(t('blogSlugTaken', { defaultValue: 'That slug is already taken.' }) as string);
        }
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setStatusMessage(t('blogSlugValidationFailed', { defaultValue: 'Could not validate slug. Try again.' }) as string);
      }
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [member?.blogHandle, open, site?.id, slug, t, user?.user_id]);

  const ready = status === 'available' || (member?.blogHandle && normalizeSlug(member.blogHandle) === slug);

  const resetToSuggestion = () => setSlug(suggestion);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.user_id || !site?.id) return;
    if (!slug || slug.length < MIN_SLUG_LENGTH) return;
    setSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await apiFetch<{ ok: boolean; slug: string }>(
        ApiRoute.USER_BLOG_REGISTER,
        {
          method: 'POST',
          pathParams: { userId: user.user_id },
          queryParams: { siteId: site.id },
          body: { slug },
        },
      );
      if (response.ok) {
        setStatus('available');
        setStatusMessage(t('blogSlugRegistered', { defaultValue: 'Blog enabled! You can start writing.' }) as string);
        if (user.user_id && site.id) {
          await fetchMember(user.user_id, site.id);
        }
        onSuccess?.(response.slug);
        onClose();
      }
    } catch (error) {
      const message =
        error instanceof Error && /409/.test(error.message)
          ? (t('blogSlugTaken', { defaultValue: 'That slug is already taken.' }) as string)
          : (t('blogRegistrationFailed', { defaultValue: 'Failed to enable your blog. Please try again.' }) as string);
      setStatus('error');
      setStatusMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} isClosable={!submitting}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('setupYourBlog', { defaultValue: 'Set up your family blog' })}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('blogSlugDescription', {
              defaultValue: 'Choose a short, memorable slug for your personal blog URL.',
            })}
          </p>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700" htmlFor="blog-slug">
            {t('blogSlugLabel', { defaultValue: 'Blog slug' })}
          </label>
          <input
            id="blog-slug"
            type="text"
            value={slug}
            onChange={(event) => setSlug(normalizeSlug(event.target.value, ''))}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500"
            autoFocus
            disabled={submitting || Boolean(member?.blogHandle)}
          />
          {member?.blogHandle ? (
            <p className="text-xs text-gray-500">
              {t('blogSlugLocked', { defaultValue: 'Your slug is permanent once created.' })}
            </p>
          ) : (
            <button
              type="button"
              onClick={resetToSuggestion}
              className="text-xs text-sage-700 hover:text-sage-900"
              disabled={submitting}
            >
              {t('useSuggestion', { defaultValue: 'Use suggestion' })}: <span className="font-medium">{suggestion}</span>
            </button>
          )}
        </div>
        <div className="rounded border px-3 py-2 bg-gray-50 text-sm">
          <span className="font-medium">{t('blogPreview', { defaultValue: 'Preview URL:' })}</span>{' '}
          <code className="text-sage-700">{`${previewBase}/blog/${slug || suggestion}`}</code>
        </div>
        {statusMessage && (
          <div
            className={`text-sm ${
              status === 'available'
                ? 'text-green-600'
                : status === 'checking'
                  ? 'text-gray-600'
                  : status === 'unavailable' || status === 'error'
                    ? 'text-red-600'
                    : 'text-gray-600'
            }`}
          >
            {statusMessage}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="px-3 py-1 rounded bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50"
            disabled={!ready || submitting}
          >
            {submitting ? t('saving') : t('startYourBlog', { defaultValue: 'Enable blog' })}
          </button>
        </div>
      </form>
    </Modal>
  );
}
