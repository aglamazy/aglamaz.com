import { NextRequest, NextResponse } from 'next/server';
import { fetchGeniImmediateFamily, fetchGeniFocusGuid, fetchGeniMe, GENI_ACCESS } from '@/integrations/geni';
import { GeniCacheRepository } from '@/repositories/GeniCacheRepository';

export const dynamic = 'force-dynamic';

const geniCacheRepository = new GeniCacheRepository();
const FAMILY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface GeniFamilyCachePayload {
  me: unknown;
  family: unknown;
}

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

    const cacheKey = `family_${guid}`;
    const cachedEntry = forceRefresh
      ? null
      : await geniCacheRepository.get<GeniFamilyCachePayload>(cacheKey, {
          ttlMs: FAMILY_CACHE_TTL_MS,
        });

    if (cachedEntry && !cachedEntry.stale) {
      const cachedData = cachedEntry.data;
      return NextResponse.json({
        me: cachedData.me || me,
        family: cachedData.family,
        cached: true,
        updatedAt: cachedEntry.updatedAt ? cachedEntry.updatedAt.getTime() : undefined,
      });
    }

    const family = await fetchGeniImmediateFamily(token, String(guid));
    await geniCacheRepository.upsert(cacheKey, { me, family });
    return NextResponse.json({ me, family, cached: false });
  } catch (err) {
    console.error('[GENI] family error', err);
    return NextResponse.json({ error: 'Failed to fetch family' }, { status: 500 });
  }
}
