'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlessingPage } from '@/entities/BlessingPage';
import type { AnniversaryEvent } from '@/entities/Anniversary';
import type { Blessing } from '@/entities/Blessing';
import { ApiRoute, AppRoute } from '@/entities/Routes';
import { getApiPath, getPath } from '@/utils/urls';
import { formatHebrewDisplay } from '@/utils/hebrew';

interface Props {
  blessingPage: BlessingPage;
  event: AnniversaryEvent;
  blessings: Blessing[];
}

export default function PublicMemorialPage({ blessingPage, event, blessings: initialBlessings }: Props) {
  const { t, i18n } = useTranslation();
  const [blessings, setBlessings] = useState(initialBlessings);
  const [formOpen, setFormOpen] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestContent, setGuestContent] = useState('');
  const [honeyputValue, setHoneyputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const formOpenedAt = useRef<number | null>(null);

  useEffect(() => {
    if (formOpen && formOpenedAt.current === null) {
      formOpenedAt.current = Date.now();
    }
  }, [formOpen]);

  const closeModal = () => {
    setFormOpen(false);
    setShowCTA(false);
  };

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
      // Switch modal to growth-loop CTA rather than closing silently
      setShowCTA(true);
    } catch (err) {
      console.error('Failed to submit public blessing:', err);
      setSubmitError(t('errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const signupPath = getPath(AppRoute.AUTH_SIGNUP);

  // event.month is 0-indexed (stored via Date.getMonth()), day and year are standard.
  // Use originalDate fields if present (they'd only be set by getEventsForMonth's
  // occurrence branch, not by getById, but we follow the pattern for safety).
  const originalMonth = event.originalMonth ?? event.month;
  const originalDay = event.originalDay ?? event.day;
  const originalYear = event.originalYear ?? event.year;
  const eventDate = new Date(originalYear, originalMonth, originalDay);
  const gregorianDateStr = eventDate.toLocaleDateString(i18n.language || 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const hebrewDateStr = event.useHebrew ? formatHebrewDisplay(eventDate) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={i18n.dir()}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-8">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">{event.name}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            {gregorianDateStr}
            {hebrewDateStr && <> &middot; {hebrewDateStr}</>}
          </p>
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
          onClick={closeModal}
        >
          <div
            className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {showCTA ? (
              /* Growth-loop CTA — shown after a successful non-member submission */
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  {t('growthLoopCtaTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm leading-relaxed">
                  {t('growthLoopCtaBody')}
                </p>
                <a
                  href={signupPath}
                  className="block w-full px-4 py-3 bg-primary text-white rounded-lg hover:opacity-90 font-semibold text-center mb-3"
                >
                  {t('growthLoopCtaButton')}
                </a>
                <button
                  onClick={closeModal}
                  className="block w-full px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {t('growthLoopCtaDismiss')}
                </button>
              </div>
            ) : (
              /* Submission form */
              <>
                <button
                  onClick={closeModal}
                  className="absolute top-3 right-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-2xl"
                >
                  &times;
                </button>
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
                    onClick={closeModal}
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
