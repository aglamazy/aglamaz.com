"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type PostLite = {
  id: string;
  primaryLocale: string;
  locales: Record<string, boolean>;
};

export default function TranslationTrigger({ posts, lang }: { posts: PostLite[]; lang: string }) {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const target = (lang || '').toLowerCase();
        const base = target.split('-')[0] || target;
        const need = posts.filter((p) => {
          if (!target) return false;
          const primaryBase = p.primaryLocale.split('-')[0];
          if (base === primaryBase) return false;
          if (p.locales[target]) return false;
          return Object.entries(p.locales).every(([key, hasContent]) => {
            if (!hasContent) return true;
            if (key === target) return false;
            const keyBase = key.split('-')[0];
            return keyBase !== base;
          });
        });
        if (need.length === 0) return;

        for (const p of need) {
          try {
            await fetch('/api/blog/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ postId: p.id, lang })
            });
          } catch (e) {
            console.error('sync translate failed', e);
          }
        }

        router.refresh();
      } catch (e) {
        console.error('TranslationTrigger error', e);
      }
    };
    run();
  }, [posts, lang, router]);

  return null;
}

