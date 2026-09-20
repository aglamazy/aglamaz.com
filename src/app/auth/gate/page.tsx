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
      // famcircle#179: the forced login on Android Chrome reopen has no known cause, so a failed
      // refresh now carries WHY into the login URL (refresh route's `reason`, or http_<status>
      // / gate_error) - readable in the address bar on the device and in request logs.
      let why: string;
      try {
        // eslint-disable-next-line no-restricted-globals
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
          return;
        }
        const body = await res.json().catch(() => null);
        why = typeof body?.reason === 'string' ? body.reason : `http_${res.status}`;
      } catch (err) {
        router.replace('/app?login=1&why=gate_error');
        throw err;
      }
      console.error('[auth gate] refresh failed:', why);
      router.replace(`/app?login=1&why=${encodeURIComponent(why)}`);
    })();
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-sm text-gray-600">Re-authenticating…</div>
    </div>
  );
}

