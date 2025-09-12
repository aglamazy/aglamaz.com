import { NextRequest, NextResponse } from 'next/server';
import { fetchGeniImmediateFamily, fetchGeniMe, GENI_ACCESS } from '@/integrations/geni';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(GENI_ACCESS)?.value;
    if (!token) return NextResponse.json({ error: 'Not connected to Geni' }, { status: 401 });

    const me = await fetchGeniMe(token);
    const guid = me?.focus?.guid || me?.guid || me?.id;
    if (!guid) return NextResponse.json({ error: 'Geni GUID not found' }, { status: 400 });

    const family = await fetchGeniImmediateFamily(token, String(guid));
    return NextResponse.json({ me, family });
  } catch (err) {
    console.error('[GENI] family error', err);
    return NextResponse.json({ error: 'Failed to fetch family' }, { status: 500 });
  }
}
