import { NextRequest } from 'next/server';
import { MemberRepository } from '@/repositories/MemberRepository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle');
    const siteId = searchParams.get('siteId');

    if (!handle || !siteId) {
      return Response.json({ error: 'Missing handle or siteId' }, { status: 400 });
    }

    // Validate handle format
    const sanitized = handle.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,50}$/.test(sanitized)) {
      return Response.json({ available: false, error: 'Invalid format' }, { status: 200 });
    }

    const repo = new MemberRepository();
    const existing = await repo.getByHandle(sanitized, siteId);

    return Response.json({ available: existing === null });
  } catch (error) {
    console.error('check handle failed', error);
    return Response.json({ error: 'Failed to check availability' }, { status: 500 });
  }
}
