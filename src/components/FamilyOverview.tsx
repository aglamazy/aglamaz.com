import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Calendar, Users, Camera, MessageCircle } from "lucide-react";
import { useSiteStore } from '@/store/SiteStore';
import { apiFetch } from '@/utils/apiFetch';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function FamilyOverview() {
  const { t } = useTranslation();
  const site = useSiteStore((s) => s.siteInfo);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [blogCount, setBlogCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!site?.id) return;
        const data = await apiFetch<{ count: number }>(`/api/site/${site.id}/members/count`);
        setMemberCount(data.count);
      } catch {
        setMemberCount(null);
      }
    })();
  }, [site?.id]);

  useEffect(() => {
    (async () => {
      try {
        if (!site?.id) return;
        const data = await apiFetch<{ count: number }>(`/api/site/${site.id}/blog/count`);
        setBlogCount(data.count);
      } catch {
        setBlogCount(null);
      }
    })();
  }, [site?.id]);

  const stats = [
    {
      title: t('familyMembers') as string,
      value: memberCount === null ? "…" : String(memberCount),
      description: t('activePortalUsers') as string,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100",
      href: '/family/members'
    },
    {
      title: t('blogPosts') as string,
      value: blogCount === null ? "…" : String(blogCount),
      description: t('storiesSharedThisYear') as string,
      icon: MessageCircle,
      color: "text-green-600",
      bg: "bg-green-100",
      href: '/blog/family'
    },
    {
      title: t('photoAlbums') as string,
      value: "24",
      description: t('preciousMemoriesCaptured') as string,
      icon: Camera,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
    {
      title: t('eventsPlanned') as string,
      value: "3",
      description: t('upcomingFamilyGatherings') as string,
      icon: Calendar,
      color: "text-orange-600",
      bg: "bg-orange-100",
    },
  ];

  const recentActivity = [
    {
      activity: 'newPhotosAddedSummer2024',
      time: 'twoHoursAgo',
      type: 'photos',
    },
    {
      activity: 'momSharedNewFamilyRecipe',
      time: 'oneDayAgo',
      type: 'blog',
    },
    {
      activity: 'dadUpdatedFamilyCalendar',
      time: 'threeDaysAgo',
      type: 'event',
    },
  ];

  return (
    <div className="p-8 pt-0">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-charcoal mb-8 text-center">
            {t('familyOverview')}
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + index * 0.1, duration: 0.4 }}
              >
                {stat.href ? (
                  <Link href={stat.href} className="block">
                    <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm cursor-pointer hover:shadow-lg transition-shadow">
                      <CardContent className="p-6 text-center">
                        <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                          <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <div className="text-3xl font-bold text-charcoal mb-2">
                          {stat.value}
                        </div>
                        <div className="font-medium text-charcoal mb-1">
                          {stat.title}
                        </div>
                        <div className="text-sm text-sage-600">
                          {stat.description}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ) : (
                  <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-6 text-center">
                      <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                      </div>
                      <div className="text-3xl font-bold text-charcoal mb-2">
                        {stat.value}
                      </div>
                      <div className="font-medium text-charcoal mb-1">
                        {stat.title}
                      </div>
                      <div className="text-sm text-sage-600">
                        {stat.description}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            ))}
          </div>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-charcoal">
                {t('recentFamilyActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 + index * 0.1, duration: 0.4 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-sage-50 hover:bg-sage-100 transition-colors duration-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-charcoal mb-1">
                        {t(item.activity)}
                      </p>
                      <p className="text-sm text-sage-600">{t(item.time)}</p>
                    </div>
                    <Badge className="border-sage-200 text-sage-600">
                      {t(item.type)}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
