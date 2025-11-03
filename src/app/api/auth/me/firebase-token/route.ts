import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { verifyAccessToken } from '@/auth/service';
import { initAdmin, adminAuth } from '@/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_TOKEN)?.value;
    const payload = token && verifyAccessToken(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    initAdmin();
    const customToken = await adminAuth().createCustomToken(payload.sub);
    return NextResponse.json({ token: customToken });
  } catch (err) {
    console.error('Failed to mint Firebase custom token', err);
    return NextResponse.json({ error: 'Failed to mint token' }, { status: 500 });
  }
}
