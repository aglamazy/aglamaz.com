// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { ACCESS_TOKEN } from "@/constants";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ACCESS_TOKEN)?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyAccessToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    user_id: payload.sub,
    roles: payload.roles ?? [],
    siteId: payload.siteId ?? null,
  });
}
