'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { useUserStore } from '@/store/UserStore';
import { IUser } from '@/entities/User';
import { useEditUserModalStore } from '@/store/EditUserModalStore';

export default function EditUserDetails() {
  const { user, setUser } = useUserStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { t, i18n } = useTranslation();
  const { close } = useEditUserModalStore();

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError(t('pleaseFillAllFields'));
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const updated = await apiFetch<IUser>('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      setUser(updated);
      close();
    } catch (err) {
      setError(t('failedToSubmit'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md" dir={i18n.dir()} lang={i18n.language}>
      <h2 className="text-xl font-semibold mb-4">{t('editProfile')}</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1" htmlFor="name">{t('name')}</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            disabled={isLoading}
          />
        </div>
        <div>
          <label className="block text-sm mb-1" htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            disabled={isLoading}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="px-4 py-2 rounded bg-gray-200"
            disabled={isLoading}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded bg-sage-600 text-white disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? t('saving') : t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
