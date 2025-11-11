import { NextRequest, NextResponse } from 'next/server';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const locale = req.nextUrl.searchParams.get('locale') || 'he';
    const siteId = await resolveSiteId();

    const siteInfo = siteId
      ? await fetchSiteInfo(siteId, locale)
      : await fetchSiteInfo(undefined, locale);

    if (!siteInfo) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json(siteInfo);
  } catch (error) {
    console.error('[api/site] Error fetching site info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site info' },
      { status: 500 }
    );
  }
}
