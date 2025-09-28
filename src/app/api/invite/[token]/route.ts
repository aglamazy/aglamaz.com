import { NextResponse } from 'next/server';
import { FamilyRepository, InviteError } from '@/repositories/FamilyRepository';
import { adminAuth, initAdmin } from '@/firebase/admin';
import { signAccessToken, signRefreshToken } from '@/auth/service';
import { setAuthCookies } from '@/auth/cookies';
import { adminNotificationService } from '@/services/AdminNotificationService';

export const dynamic = 'force-dynamic';

const statusByCode: Record<string, number> = {
  'invite/not-found': 404,
  'invite/expired': 410,
  'invite/used': 409,
  'invite/revoked': 410,
  'invite/already-member': 409,
  'invite/wrong-site': 403,
  'invite/missing-email': 400,
};

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const token = params?.token;
  if (!token) {
    console.warn('[invite][GET] missing token');
    return NextResponse.json({ error: 'Missing token', code: 'invite/missing-token' }, { status: 400 });
  }

  try {
    console.info('[invite][GET] loading invite', { token });
    const familyRepository = new FamilyRepository();
    const invite = await familyRepository.getInviteByToken(token);
    if (!invite) {
      console.warn('[invite][GET] invite not found', { token });
      return NextResponse.json({ error: 'Invite not found', code: 'invite/not-found' }, { status: 404 });
    }

    const site = await familyRepository.getSite(invite.siteId);
    console.info('[invite][GET] invite loaded', {
      token,
      siteId: invite.siteId,
      status: invite.status,
      expiresAt: invite.expiresAt.toDate().toISOString(),
    });
    const payload = {
      invite: {
        token: invite.token,
        status: invite.status,
        siteId: invite.siteId,
        siteName: site?.name || null,
        inviterName: invite.inviterName || null,
        expiresAt: invite.expiresAt.toDate().toISOString(),
      },
    };

    if (invite.status === 'expired') {
      console.info('[invite][GET] invite expired', { token });
      return NextResponse.json({ ...payload, error: 'Invite expired', code: 'invite/expired' }, { status: 410 });
    }
    if (invite.status === 'revoked') {
      console.info('[invite][GET] invite revoked', { token });
      return NextResponse.json({ ...payload, error: 'Invite revoked', code: 'invite/revoked' }, { status: 410 });
    }

    console.info('[invite][GET] invite active', { token });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[invite][GET] failed to load invite', { token }, error);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const token = params?.token;
  if (!token) {
    console.warn('[invite][POST] missing token');
    return NextResponse.json({ error: 'Missing token', code: 'invite/missing-token' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const idToken = body?.idToken;
    if (typeof idToken !== 'string' || !idToken) {
      return NextResponse.json({ error: 'Missing idToken', code: 'auth/missing-id-token' }, { status: 400 });
    }

    initAdmin();
    const decoded = await adminAuth().verifyIdToken(idToken);
    const familyRepository = new FamilyRepository();
    const invite = await familyRepository.getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found', code: 'invite/not-found' }, { status: 404 });
    }

    const pendingClaims = {
      userId: decoded.uid,
      siteId: invite.siteId,
      role: 'pending' as const,
      firstName: decoded.name?.split(' ')[0] || body?.firstName || '',
      lastName: '',
      email: decoded.email || body?.email || '',
    };

    const respondWithClaims = (status: number, payload: any, claims = pendingClaims) => {
      const access = signAccessToken(claims, 10);
      const refresh = signRefreshToken(claims, 30);
      const response = NextResponse.json(payload, { status });
      setAuthCookies(response, access, refresh);
      return response;
    };

    if (invite.status === 'revoked') {
      return respondWithClaims(410, { error: 'Invite revoked', code: 'invite/revoked' });
    }
    if (invite.status === 'expired') {
      return respondWithClaims(410, { error: 'Invite expired', code: 'invite/expired' });
    }

    const member = await familyRepository.acceptInvite(token, {
      uid: decoded.uid,
      siteId: invite.siteId,
      email: decoded.email || body?.email || '',
      displayName: decoded.name || decoded.email || undefined,
      firstName: decoded.name?.split(' ')[0] || undefined,
    });

    const memberClaims = {
      userId: decoded.uid,
      siteId: invite.siteId,
      role: (member.role || 'member') as 'member' | 'admin',
      firstName: member.firstName || member.displayName || pendingClaims.firstName,
      lastName: '',
      email: decoded.email || body?.email || '',
    };

    try {
      const origin = new URL(request.url).origin;
      await adminNotificationService.notify('new_member', {
        siteId: invite.siteId,
        memberId: member.id,
        firstName: member.firstName || member.displayName || pendingClaims.firstName,
        email: decoded.email || body?.email || '',
        role: member.role,
      }, origin);
    } catch (notifyError) {
      console.error('[invite][POST] failed to notify admin about new member', notifyError);
    }

    return respondWithClaims(200, { member, status: 'member' }, memberClaims as any);
  } catch (error) {
    if (error instanceof InviteError) {
      const status = statusByCode[error.code] ?? 400;
      console.warn('[invite][POST] invite error', { token, code: error.code, message: error.message });
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[invite][POST] failed to accept invite', { token }, error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
}
