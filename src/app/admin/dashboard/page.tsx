'use client';

import { useRouter } from 'next/navigation';
import { FileText, Users, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import ArrowCTA from '@/components/ArrowCTA';

export default function AdminDashboard() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('he');

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

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="bg-white border-b border-sage-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-charcoal">
            {t('adminDashboard') || 'Admin Dashboard'}
          </h1>
          <p className="mt-2 text-sage-600">
            {t('adminDashboardSubtitle') || 'Manage your site settings and members'}
          </p>
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
