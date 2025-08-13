'use client';

import { useEffect } from 'react';
import { initFirebase, auth } from '../firebase/client';
import { useUserStore } from '../store/UserStore';

export function useSessionRefresh() {
  useEffect(() => {
    initFirebase();
    const authInstance = auth();

    const refresh = async () => {
      const user = authInstance.currentUser;
      if (user) {
        try {
          const idToken = await user.getIdToken(true);
          await fetch('/api/sessionRefresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          await useUserStore.getState().checkAuth();
        } catch (e) {
          // ignore
        }
      }
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);
}
