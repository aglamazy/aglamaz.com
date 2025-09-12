'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function GeniExampleAppPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any | null>(null);
  const [family, setFamily] = useState<any | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // First, check connection status via /api/geni/me
        const meRes = await fetch('/api/geni/me', { cache: 'no-store' });
        if (meRes.ok) {
          const meData = await meRes.json();
          setConnected(true);
          setMe(meData);
          // Then load family (uses cache on server)
          const famRes = await fetch('/api/geni/family', { cache: 'no-store' });
          if (famRes.ok) {
            const famData = await famRes.json();
            setMe(famData.me || meData);
            setFamily(famData.family || null);
          }
        } else if (meRes.status === 401) {
          setConnected(false);
        } else {
          const text = await meRes.text();
          setError(text || 'Failed');
        }
      } catch (e: any) {
        setError(e?.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setError('OAuth error');
    }
  }, []);

  return (
    <div className="py-10">
      <div className="max-w-3xl mx-auto px-2 sm:px-4">
        <h1 className="text-3xl font-bold text-charcoal mb-6">{t('geniIntegration')}</h1>

        {!connected && (
          <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm mb-6">
            <CardContent className="p-6">
              <p className="text-sage-700 mb-4">{t('connectYourGeniAccount')}</p>
              <a href="/api/geni/start">
                <Button>{t('connectToGeni')}</Button>
              </a>
              {loading && <div className="text-sage-600 mt-3">{t('loading')}</div>}
              {error && <div className="text-red-600 mt-3">{t('somethingWentWrong')}</div>}
            </CardContent>
          </Card>
        )}

        {connected && (
          <Card className="border-0 shadow-md bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-charcoal">{t('basicInformation')}</h2>
                <a href="/api/geni/family?refresh=1" className="text-sage-700 underline hover:no-underline">
                  {t('refreshData')}
                </a>
              </div>
              <div className="text-sage-700">
                <div><span className="font-semibold">ID:</span> {String(me?.id ?? me?.guid ?? '')}</div>
                <div><span className="font-semibold">Name:</span> {me?.name || me?.display_name || '-'}</div>
                <div><span className="font-semibold">Email:</span> {me?.email || '-'}</div>
              </div>
              {family && (
                <div className="mt-6 grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-charcoal mb-2">Parents</h3>
                    <ul className="list-disc ml-5 text-sage-700">
                      {(family?.parents || []).map((p: any) => (
                        <li key={p?.id || p?.guid}>{p?.name || p?.display_name}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-charcoal mb-2">Siblings</h3>
                    <ul className="list-disc ml-5 text-sage-700">
                      {(family?.siblings || []).map((s: any) => (
                        <li key={s?.id || s?.guid}>{s?.name || s?.display_name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
