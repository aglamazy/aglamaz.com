import { NextRequest, NextResponse } from 'next/server';
import { fetchGeniImmediateFamily, fetchGeniFocusGuid, fetchGeniMe, GENI_ACCESS } from '@/integrations/geni';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(GENI_ACCESS)?.value;
    if (!token) return NextResponse.json({ error: 'Not connected to Geni' }, { status: 401 });

    const url = new URL(req.url);
    const overrideGuid = url.searchParams.get('guid');
    const forceRefresh = url.searchParams.get('refresh') === '1' || url.searchParams.get('refresh') === 'true';

    const me = await fetchGeniMe(token);
    let guid = overrideGuid || (await fetchGeniFocusGuid(token));
    if (!guid) {
      console.warn('[GENI] GUID not found on /family; keys:', Object.keys(me || {}));
      return NextResponse.json({ error: 'Geni GUID not found' }, { status: 400 });
    }

    // Firestore caching for 24h
    initAdmin();
    const db = getFirestore();
    const docRef = db.collection('geni_cache').doc(`family_${guid}`);
    if (!forceRefresh) {
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data() as any;
        const ts: Timestamp | undefined = data?.updatedAt;
        const updatedAt = ts ? ts.toDate().getTime() : 0;
        const ageMs = Date.now() - updatedAt;
        const dayMs = 24 * 60 * 60 * 1000;
        if (ageMs < dayMs) {
          return NextResponse.json({ me: data.me || me, family: data.family, cached: true, updatedAt: updatedAt });
        }
      }
    }

    const family = await fetchGeniImmediateFamily(token, String(guid));
    await docRef.set({ me, family, updatedAt: Timestamp.now() }, { merge: true });
    return NextResponse.json({ me, family, cached: false });
  } catch (err) {
    console.error('[GENI] family error', err);
    return NextResponse.json({ error: 'Failed to fetch family' }, { status: 500 });
  }
}
