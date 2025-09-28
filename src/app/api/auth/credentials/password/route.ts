import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN, setAuthCookies } from '@/auth/cookies';
import { verifyAccessToken, signAccessToken, signRefreshToken } from '@/auth/service';
import { initAdmin, adminAuth } from '@/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const { password } = body as { password?: string };
    if (typeof password === 'string') {
      console.warn('[credentials][password] received password in request body; ignoring client payload');
    }

    const cookieStore = cookies();
    const token = cookieStore.get(ACCESS_TOKEN)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (payload as any).userId || payload.sub;
    initAdmin();
    const userRecord = await adminAuth().getUser(userId);

    const providerIds = userRecord.providerData?.map(p => p?.providerId).filter(Boolean) ?? [];
    const hasPasswordProvider = providerIds.includes('password');
    const hasGoogleProvider = providerIds.includes('google.com');
    if (!hasPasswordProvider) {
      return NextResponse.json({ error: 'Password provider missing on account' }, { status: 400 });
    }
    const needsCredentialSetup = !(hasPasswordProvider || hasGoogleProvider);

    const claims = {
      userId,
      siteId: (payload as any).siteId || '',
      role: (payload as any).role || 'member',
      firstName: (payload as any).firstName || userRecord.displayName || '',
      lastName: (payload as any).lastName || '',
      email: userRecord.email || (payload as any).email || '',
      needsCredentialSetup,
    } as const;

    const access = signAccessToken(claims, 10);
    const refresh = signRefreshToken(claims, 30);
    const response = NextResponse.json({ success: true, needsCredentialSetup });
    setAuthCookies(response, access, refresh);
    return response;
  } catch (error) {
    console.error('[credentials][password] failed', error);
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
