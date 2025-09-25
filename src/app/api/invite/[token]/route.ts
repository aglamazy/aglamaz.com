import { NextResponse } from 'next/server';
import { FamilyRepository, InviteError } from '@/repositories/FamilyRepository';
import { withUserGuard } from '@/lib/withUserGuard';
import type { GuardContext } from '@/app/api/types';
import { adminAuth, initAdmin } from '@/firebase/admin';

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

const postHandler = async (request: Request, context: GuardContext) => {
  const token = context.params?.token;
  if (!token) {
    console.warn('[invite][POST] missing token');
    return NextResponse.json({ error: 'Missing token', code: 'invite/missing-token' }, { status: 400 });
  }

  try {
    const user = context.user;
    if (!user?.userId || !user.siteId) {
      console.warn('[invite][POST] unauthorized', { token, userId: user?.userId, siteId: user?.siteId });
      return NextResponse.json({ error: 'Unauthorized', code: 'auth/unauthorized' }, { status: 401 });
    }

    console.info('[invite][POST] accepting invite', { token, userId: user.userId, siteId: user.siteId });
    initAdmin();
    const userRecord = await adminAuth().getUser(user.userId);
    if (!userRecord.email) {
      console.warn('[invite][POST] missing email', { token, userId: user.userId });
      return NextResponse.json({ error: 'User email is required', code: 'invite/missing-email' }, { status: 400 });
    }

    const familyRepository = new FamilyRepository();
    const member = await familyRepository.acceptInvite(token, {
      uid: user.userId,
      siteId: user.siteId,
      email: userRecord.email,
      displayName: userRecord.displayName || userRecord.email || undefined,
      firstName: user.firstName || undefined,
    });

    console.info('[invite][POST] invite accepted', { token, memberId: member.id, role: member.role });
    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof InviteError) {
      const status = statusByCode[error.code] ?? 400;
      console.warn('[invite][POST] invite error', { token, code: error.code, message: error.message });
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[invite][POST] failed to accept invite', { token }, error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
};

export const POST = withUserGuard(postHandler);
