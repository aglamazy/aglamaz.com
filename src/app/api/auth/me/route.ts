// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN } from '@/auth/cookies';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ACCESS_TOKEN)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized (me, nt)' }, { status: 401 });

  const payload = verifyAccessToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized (me)' }, { status: 401 });

  return NextResponse.json({
    user_id: payload.sub,
    roles: (payload as any).roles ?? [],
    siteId: (payload as any).siteId ?? null,
    needsCredentialSetup: (payload as any).needsCredentialSetup ?? false,
  });
}
