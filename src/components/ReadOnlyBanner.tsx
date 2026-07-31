'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLoginModalStore } from '@/store/LoginModalStore';

// Shown whenever the current session was resolved from a page-level read
// token (famcircle#125), not a full Firebase login - lets visitors know why
// write actions across the app (calendar, photos, ...) are hidden/disabled,
// per docs/family-digest-formats-spec.md §7 ("any WRITE action still
// requires full login").
export default function ReadOnlyBanner() {
  const { t } = useTranslation();
  const openLogin = useLoginModalStore((state) => state.open);

  return (
    <div className="w-full bg-amber-100 text-amber-900 text-sm px-4 py-2 flex items-center justify-center gap-2 flex-wrap text-center">
      <span>{t('readOnlyBannerMessage')}</span>
      <button
        type="button"
        onClick={openLogin}
        className="underline font-medium hover:text-amber-950"
      >
        {t('readOnlyBannerLoginCta')}
      </button>
    </div>
  );
}
