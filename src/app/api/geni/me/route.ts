import { NextRequest, NextResponse } from 'next/server';
import { fetchGeniMe, GENI_ACCESS } from '@/integrations/geni';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(GENI_ACCESS)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not connected to Geni' }, { status: 401 });
    }
    const me = await fetchGeniMe(token);
    return NextResponse.json(me);
  } catch (err) {
    console.error('GENI me error:', err);
    // Rethrow as 500 response so callers can react
    return NextResponse.json({ error: 'Failed to fetch Geni profile' }, { status: 500 });
  }
}

