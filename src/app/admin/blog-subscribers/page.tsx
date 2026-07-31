'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSiteStore } from '@/store/SiteStore';
import { Mail } from 'lucide-react';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import { useTranslation } from 'react-i18next';
import { formatLocalizedDateTime } from '@/utils/dateFormat';

interface BlogSubscriber {
  id: string;
  email: string;
  createdAt: any;
}

export default function BlogSubscribersPage() {
  const { t, i18n } = useTranslation();
  const site = useSiteStore(state => state.siteInfo);
  const [subscribers, setSubscribers] = useState<BlogSubscriber[]>([]);

  useEffect(() => {
    const load = async (siteId: string) => {
      const data = await apiFetch<{ data: BlogSubscriber[] }>(ApiRoute.SITE_BLOG_SUBSCRIBERS, {
        pathParams: { siteId },
      });
      setSubscribers(data.data || []);
    };
    if (site?.id) load(site.id);
  }, [site?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Mail size={32} className="text-sage-600" />
          <h1 className="text-3xl font-bold text-sage-700">{t('blogSubscribers')}</h1>
          {subscribers.length > 0 && (
            <span className="bg-sage-100 text-sage-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {subscribers.length}
            </span>
          )}
        </div>
        {subscribers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">{t('noBlogSubscribersYet')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {subscribers.map(s => (
              <Card key={s.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center">
                    <p className="text-gray-800">{s.email}</p>
                    <div className="text-sm text-gray-500">{formatLocalizedDateTime(s.createdAt, i18n.language)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
