'use client';

import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { initFirebase, auth } from '../firebase/client';

export function useIdTokenRefresh() {
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initFirebase();
    const authInstance = auth();

    const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          document.cookie = `token=${token}; path=/`;
        } catch (error) {
          console.error('Failed to get ID token:', error);
        }

        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }

        refreshIntervalRef.current = setInterval(async () => {
          try {
            const refreshedToken = await user.getIdToken(true);
            document.cookie = `token=${refreshedToken}; path=/`;
          } catch (error) {
            console.error('Failed to refresh ID token:', error);
          }
        }, 50 * 60 * 1000); // Refresh every 50 minutes
      } else {
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      }
    });

    return () => {
      unsubscribe();
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);
}

