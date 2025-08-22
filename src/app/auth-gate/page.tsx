'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthGate() {
  const router = useRouter();

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
          router.replace(originalUrl);
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-sm text-gray-600">Re-authenticating…</div>
    </div>
  );
}

