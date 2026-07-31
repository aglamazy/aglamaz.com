'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLoginModalStore } from '@/store/LoginModalStore';

// Rendered instead of a write form (add/edit event, upload photo, ...) when the
// visitor reached the page directly (e.g. via a bookmarked/typed URL) while on a
// read-only, token-derived session (famcircle#125). The API already rejects the
// write (famcircle#125), so this is purely to avoid presenting a form that will
// silently fail on submit.
export default function ReadOnlyNotice() {
  const { t } = useTranslation();
  const openLogin = useLoginModalStore((state) => state.open);

  return (
    <div className="max-w-md mx-auto p-6 text-center space-y-3">
      <p className="text-text">{t('readOnlyFormMessage')}</p>
      <button
        type="button"
        onClick={openLogin}
        className="px-4 py-2 bg-primary text-white rounded"
      >
        {t('readOnlyBannerLoginCta')}
      </button>
    </div>
  );
}
