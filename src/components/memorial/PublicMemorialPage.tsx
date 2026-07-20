'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { BlessingPage } from '@/entities/BlessingPage';
import type { AnniversaryEvent } from '@/entities/Anniversary';
import type { Blessing } from '@/entities/Blessing';
import { AppRoute, ApiRoute } from '@/entities/Routes';
import { getApiPath, getPath } from '@/utils/urls';

interface Props {
  blessingPage: BlessingPage;
  event: AnniversaryEvent;
  blessings: Blessing[];
}

export default function PublicMemorialPage({ blessingPage, event, blessings: initialBlessings }: Props) {
  const { t, i18n } = useTranslation();
  const [blessings, setBlessings] = useState(initialBlessings);
  const [formOpen, setFormOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestContent, setGuestContent] = useState('');
  const [honeyputValue, setHoneyputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const formOpenedAt = useRef<number | null>(null);

  useEffect(() => {
    if (formOpen && formOpenedAt.current === null) {
      formOpenedAt.current = Date.now();
    }
  }, [formOpen]);

  const handleSubmit = async () => {
    if (!guestName.trim() || !guestContent.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const url = getApiPath(ApiRoute.SITE_BLESSING_PAGE_PUBLIC_BLESSINGS, blessingPage.siteId, {
        pageId: blessingPage.id,
      });
      // Deliberately native fetch, not apiFetch: this page has no logged-in
      // session, so there's no siteId in the store and no auth header to add
      // — apiFetch would throw trying to read siteId from useSiteStore.
      // eslint-disable-next-line no-restricted-globals
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: guestName,
          guestEmail: guestEmail || undefined,
          content: guestContent,
          honeyputValue,
          timeToSubmitMs: formOpenedAt.current ? Date.now() - formOpenedAt.current : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.blessing) {
        setBlessings((prev) => [data.blessing, ...prev]);
      }
      setGuestName('');
      setGuestEmail('');
      setGuestContent('');
      setHoneyputValue('');
      formOpenedAt.current = null;
      setJustSubmitted(true);
    } catch (err) {
      console.error('Failed to submit public blessing:', err);
      setSubmitError(t('errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={i18n.dir()}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">{event.name}</h1>
          {event.type !== 'death' && typeof blessingPage.year === 'number' && (
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
              {t('blessingPageTitle')} - {blessingPage.year}
            </p>
          )}
          {event.description && (
            <p className="text-gray-700 dark:text-gray-300 mb-4">{event.description}</p>
          )}
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.name}
              className="w-full max-w-md mx-auto rounded-lg mb-6"
            />
          )}

          <div className="mt-6 flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('blessingsCount', { count: blessings.length })}
            </h2>
            <button
              onClick={() => setFormOpen(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 text-sm"
            >
              {t('addYourBlessing')}
            </button>
          </div>
          <div className="mb-6">
            {blessings.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                {t('noBlessingsYet')}
              </p>
            ) : (
              <div className="space-y-4">
                {blessings.map((blessing) => (
                  <div
                    key={blessing.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-semibold">
                        {blessing.authorName.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {blessing.authorName}
                      </span>
                      {blessing.isNonMemberContribution && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                          {t('nonMemberContributionBadge')}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: blessing.content }}
                      dir={i18n.dir()}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 z-50"
          onClick={() => {
            setFormOpen(false);
            setJustSubmitted(false);
          }}
        >
          <div
            className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setFormOpen(false);
                setJustSubmitted(false);
              }}
              className="absolute top-3 right-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
            >
              &times;
            </button>

            {justSubmitted ? (
              <div className="text-center py-4">
                <h2 className="text-2xl font-bold mb-2">{t('blessingPostedThankYou')}</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">{t('growthCtaMessage')}</p>
                <Link
                  href={getPath(AppRoute.AUTH_SIGNUP)}
                  className="inline-block px-5 py-2.5 bg-primary text-white rounded-lg hover:opacity-90"
                >
                  {t('growthCtaButton')}
                </Link>
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setFormOpen(false);
                      setJustSubmitted(false);
                    }}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-4">{t('addYourBlessing')}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('nonMemberContributionHint')}</p>

                <div className="mb-3">
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('guestNamePlaceholder')}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700"
                    maxLength={100}
                  />
                </div>
                <div className="mb-3">
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder={t('guestEmailPlaceholder')}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700"
                    maxLength={200}
                  />
                </div>
                {/* Honeypot — hidden from real visitors via CSS, left blank by them; a filled value is a strong bot signal. */}
                <input
                  type="text"
                  value={honeyputValue}
                  onChange={(e) => setHoneyputValue(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="absolute -left-[9999px] w-px h-px opacity-0"
                  aria-hidden="true"
                />
                <div className="mb-4">
                  <textarea
                    value={guestContent}
                    onChange={(e) => setGuestContent(e.target.value)}
                    placeholder={t('writeBlessingPlaceholder')}
                    rows={5}
                    maxLength={5000}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700"
                  />
                </div>
                {submitError && <p className="text-red-600 text-sm mb-3">{submitError}</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setFormOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !guestName.trim() || !guestContent.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? t('submitting') : t('postBlessing')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
