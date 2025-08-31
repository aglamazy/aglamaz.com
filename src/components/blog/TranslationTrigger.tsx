"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type PostLite = {
  id: string;
  sourceLang: string;
  translations?: Record<string, { title: string; content: string }>;
};

export default function TranslationTrigger({ posts, lang }: { posts: PostLite[]; lang: string }) {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const base = (lang || '').split('-')[0]?.toLowerCase();
        const need = posts.filter((p) => {
          if (!lang || base === (p.sourceLang || '').split('-')[0]) return false;
          const tr = p.translations || {};
          if ((tr as any)[lang]) return false;
          return Object.keys(tr).every(k => (k.split('-')[0]?.toLowerCase() !== base));
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

