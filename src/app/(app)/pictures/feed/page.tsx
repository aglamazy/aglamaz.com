'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import I18nText from '@/components/I18nText';
import { apiFetch } from '@/utils/apiFetch';
import styles from './page.module.css';

interface AnniversaryOccurrence {
  id: string;
  date: any;
  images?: string[];
}

function toMillis(raw: any): number {
  if (raw?.toMillis) return raw.toMillis();
  if (raw?.toDate) return raw.toDate().getTime();
  if (typeof raw?._seconds === 'number') return raw._seconds * 1000;
  if (typeof raw?.seconds === 'number') return raw.seconds * 1000;
  return new Date(raw).getTime();
}

export default function PicturesFeedPage() {
  const [items, setItems] = useState<AnniversaryOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<{ items: AnniversaryOccurrence[] }>('/api/pictures');
        if (!mounted) return;
        const sorted = [...(data.items || [])].sort((a, b) => toMillis(b.date) - toMillis(a.date));
        setItems(sorted);
      } catch (e) {
        console.error(e);
        if (mounted) setError('load');
        throw e;
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <I18nText k="loading" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4">
        <I18nText k="somethingWentWrong" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="p-4">
        <I18nText k="noPicturesYet" />
      </div>
    );
  }

  return (
    <div className={`p-4 ${styles.grid}`}>
      {items.map((occ) => {
        const date = new Date(toMillis(occ.date));
        const images = Array.isArray(occ.images) ? occ.images : [];
        return (
          <Card key={occ.id}>
            <CardHeader>
              <CardTitle>{date.toLocaleDateString()}</CardTitle>
            </CardHeader>
            <CardContent>
              {images.map((url, idx) => (
                <img key={idx} src={url} alt="" className={styles.image} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
