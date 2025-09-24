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
    return NextResponse.json({ error: 'Missing token', code: 'invite/missing-token' }, { status: 400 });
  }

  try {
    const familyRepository = new FamilyRepository();
    const invite = await familyRepository.getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found', code: 'invite/not-found' }, { status: 404 });
    }

    const site = await familyRepository.getSite(invite.siteId);
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
      return NextResponse.json({ ...payload, error: 'Invite expired', code: 'invite/expired' }, { status: 410 });
    }
    if (invite.status === 'revoked') {
      return NextResponse.json({ ...payload, error: 'Invite revoked', code: 'invite/revoked' }, { status: 410 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Failed to load invite', error);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}

const postHandler = async (request: Request, context: GuardContext) => {
  const token = context.params?.token;
  if (!token) {
    return NextResponse.json({ error: 'Missing token', code: 'invite/missing-token' }, { status: 400 });
  }

  try {
    const user = context.user;
    if (!user?.userId || !user.siteId) {
      return NextResponse.json({ error: 'Unauthorized', code: 'auth/unauthorized' }, { status: 401 });
    }

    initAdmin();
    const userRecord = await adminAuth().getUser(user.userId);
    if (!userRecord.email) {
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

    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof InviteError) {
      const status = statusByCode[error.code] ?? 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('Failed to accept invite', error);
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
  }
};

export const POST = withUserGuard(postHandler);
