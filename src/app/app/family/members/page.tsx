"use client";

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteStore } from '@/store/SiteStore';
import { apiFetch } from '@/utils/apiFetch';

interface MemberLite {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  role: string;
  blogHandle?: string | null;
}

export default function FamilyMembersPage() {
  const { t } = useTranslation();
  const site = useSiteStore((s) => s.siteInfo);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (!site?.id) return;
        setLoading(true);
        const data = await apiFetch<{ members: MemberLite[] }>(`/api/site/${site.id}/members/public`);
        setMembers(data.members || []);
      } catch (e) {
        setError('Failed to load members');
      } finally {
        setLoading(false);
      }
    })();
  }, [site?.id]);

  if (loading) return <div className="p-6">{t('loading')}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="px-4 py-6">
      <div className="mx-auto max-w-xl sm:max-w-2xl lg:max-w-3xl space-y-3">
        {members.map(m => {
          const name = m.displayName || m.email || 'Member';
          const initials = name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(s => s[0]?.toUpperCase())
            .join('') || 'M';
          return (
            <div key={m.id} className="flex items-center justify-between border rounded-xl p-4 bg-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-sage-600 text-white flex items-center justify-center text-sm font-semibold">
                  {initials}
                </div>
                <div>
                  <div className="font-medium leading-tight">{name}</div>
                  <div className="text-xs text-gray-500 capitalize">{m.role}</div>
                </div>
              </div>
              {m.blogHandle ? (
                <a
                  className="text-blue-600 hover:underline text-sm"
                  href={`/blog/author/${m.blogHandle}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Blog
                </a>
              ) : null}
            </div>
          );
        })}
        {members.length === 0 && <div className="text-gray-500">No members yet.</div>}
      </div>
    </div>
  );
}
