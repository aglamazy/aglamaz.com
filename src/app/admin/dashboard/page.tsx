'use client';

import { useRouter } from 'next/navigation';
import { FileText, Users, MessageCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import ArrowCTA from '@/components/ArrowCTA';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useState } from 'react';
import { useEffect } from 'react';
import { useSiteStore } from '@/store/SiteStore';

export default function AdminDashboard() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('he');
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminEmailSaving, setAdminEmailSaving] = useState(false);
  const [adminEmailError, setAdminEmailError] = useState('');
  const [adminEmailSaved, setAdminEmailSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const missingAdminEmail = hydrated && !siteInfo?.ownerUid;

  useEffect(() => {
    useSiteStore.getState().hydrateFromWindow();
    setHydrated(true);
  }, []);

  const adminFeatures = [
    {
      icon: FileText,
      title: t('siteDescription'),
      description: t('manageSiteDescription') || 'Edit the site description and welcome message',
      href: '/admin/site-description',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      icon: Users,
      title: t('pendingMembers'),
      description: t('managePendingMembers') || 'Review and approve pending member requests',
      href: '/admin/pending-members',
      gradient: 'from-amber-500 to-amber-600',
    },
    {
      icon: Users,
      title: t('siteMembers'),
      description: t('manageSiteMembers') || 'View and manage all site members',
      href: '/admin/site-members',
      gradient: 'from-green-500 to-green-600',
    },
    {
      icon: MessageCircle,
      title: t('contactMessages'),
      description: t('manageContactMessages') || 'View and respond to contact form messages',
      href: '/admin/contact-messages',
      gradient: 'from-purple-500 to-purple-600',
    },
  ];

  const handleClearCache = async () => {
    setClearingCache(true);
    setCacheCleared(false);
    try {
      await apiFetch(ApiRoute.SITE_ADMIN_CACHE_REVALIDATE, {
        pathParams: { siteId: siteInfo?.id || '' },
        method: 'POST',
      });
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 3000);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  };

  const handleSaveAdminEmail = async () => {
    if (!adminEmailInput.trim()) {
      setAdminEmailError(t('pleaseFillAllFields') || 'Please fill all fields');
      return;
    }
    setAdminEmailSaving(true);
    setAdminEmailError('');
    setAdminEmailSaved(false);
    try {
      const res = await apiFetch<{ ownerUid: string; email: string | null }>(ApiRoute.SITE_ADMIN_OWNER, {
        method: 'POST',
        body: { email: adminEmailInput.trim() },
      });
      if (siteInfo) {
        setSiteInfo({ ...siteInfo, ownerUid: res.ownerUid });
      }
      setAdminEmailSaved(true);
      setTimeout(() => setAdminEmailSaved(false), 3000);
    } catch (error) {
      console.error('[admin] failed to set admin email', error);
      setAdminEmailError(t('failedToSaveSettings') || 'Failed to save');
    } finally {
      setAdminEmailSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-sage-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-charcoal">
                {t('adminDashboard') || 'Admin Dashboard'}
              </h1>
              <p className="mt-2 text-sage-600">
                {t('adminDashboardSubtitle') || 'Manage your site settings and members'}
              </p>
            </div>
            <Button
              onClick={handleClearCache}
              disabled={clearingCache || cacheCleared}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${clearingCache ? 'animate-spin' : ''}`} />
              {cacheCleared ? (t('cacheCleared') || 'Cache Cleared!') : (t('clearCache') || 'Clear Cache')}
            </Button>
          </div>
          {missingAdminEmail && (
            <div className="mt-6 border border-amber-200 bg-amber-50 rounded-lg p-4 flex flex-col gap-3">
              <div className="text-amber-800 font-semibold">
                {t('adminEmailMissing', { defaultValue: 'Admin email is missing' })}
              </div>
              <div className="text-amber-700 text-sm">
                {t('adminEmailMissingDesc', {
                  defaultValue: 'Set an admin email to receive contact form and member approval notifications.',
                })}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  className="w-full sm:w-96 border border-amber-200 rounded-md px-3 py-2"
                  placeholder={t('adminEmailPlaceholder', { defaultValue: 'admin@example.com' }) as string}
                />
                <Button
                  onClick={handleSaveAdminEmail}
                  disabled={adminEmailSaving}
                  className="sm:w-auto"
                >
                  {adminEmailSaving ? (t('saving') || 'Saving...') : (t('save') || 'Save')}
                </Button>
              </div>
              {adminEmailError && (
                <div className="text-red-600 text-sm">{adminEmailError}</div>
              )}
              {adminEmailSaved && (
                <div className="text-green-700 text-sm">
                  {t('settingsSavedSuccessfully') || 'Saved successfully'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Admin Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminFeatures.map(({ icon: Icon, title, description, href, gradient }) => (
            <Card
              key={href}
              className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/80 backdrop-blur-sm cursor-pointer"
              onClick={() => router.push(href)}
            >
              <CardContent className="p-8 h-full flex flex-col">
                <div className={`w-16 h-16 bg-gradient-to-r ${gradient} rounded-2xl flex items-center justify-center mb-6`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-charcoal mb-3">{title}</h3>
                <p className="text-sage-600 mb-6 leading-relaxed">{description}</p>
                <div className="mt-auto flex justify-end">
                  <Button className="border-sage-200 hover:border-sage-300 hover:bg-sage-50 group">
                    {t('manage') || 'Manage'}
                    <ArrowCTA isRTL={isRTL} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
