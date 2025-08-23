'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSiteStore } from "@/store/SiteStore";
import { useMemberStore } from "@/store/MemberStore";
import { useUserStore } from "@/store/UserStore";

export default function AuthGate() {
  const router = useRouter();

  const { checkAuth } = useUserStore();
  const { fetchMember } = useMemberStore();
  const siteId = useSiteStore(s => s.siteInfo?.id);

  useEffect(() => {
    const originalUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';

    (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          await checkAuth();
          const u = useUserStore.getState().user;
          if (u?.user_id && siteId) await fetchMember(u.user_id, siteId);
          router.replace(originalUrl);
        } else {
          router.replace('/app?login=1');
        }
      } catch (err) {
        router.replace('/app?login=1');
        throw err;
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-sm text-gray-600">Re-authenticating…</div>
    </div>
  );
}

