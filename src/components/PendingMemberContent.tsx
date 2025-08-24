'use client';
import React from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/utils/apiFetch';
import { landingPage } from '@/app/settings';

export default function PendingMemberContent() {
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const handleLogout = async () => {
    await apiFetch<void>('/api/auth/logout', { method: 'POST' });
    router.push(landingPage);
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center space-y-4" dir={i18n.dir()} lang={i18n.language}>
      <div className="mx-auto mb-4">
        <Clock className="w-16 h-16 text-yellow-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">{t('pendingApprovalTitle')}</h2>
      <p className="text-gray-600">{t('pendingApprovalMessage')}</p>
      <p className="text-gray-600">{t('pendingApprovalNotify')}</p>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-blue-800">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{t('pendingApprovalRequestSent')}</span>
        </div>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{t('pendingApprovalWaitingAdmin')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-8">
        <Link href="/contact" passHref legacyBehavior>
          <Button className="w-full bg-black text-white rounded hover:bg-gray-800">{t('contactUs')}</Button>
        </Link>
        <Button className="w-full bg-gray-200 text-gray-800 rounded hover:bg-gray-300" onClick={handleLogout} type="button">{t('logout')}</Button>
      </div>
    </div>
  );
}
