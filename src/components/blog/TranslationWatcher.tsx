"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  enabled: boolean;
  intervalMs?: number;
  maxAttempts?: number;
}

export default function TranslationWatcher({ enabled, intervalMs = 3000, maxAttempts = 4 }: Props) {
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      attempts.current += 1;
      router.refresh();
      if (attempts.current >= maxAttempts) {
        clearInterval(id);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, maxAttempts, router]);

  return null;
}

