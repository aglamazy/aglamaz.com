import { NextResponse } from 'next/server';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { adminAuth, initAdmin } from '@/firebase/admin';
import { signAccessToken, signRefreshToken } from '@/auth/service';
import { setAuthCookies } from '@/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { inviteToken, verificationToken } = await request.json().catch(() => ({}));

    if (typeof inviteToken !== 'string' || !inviteToken || typeof verificationToken !== 'string' || !verificationToken) {
      return NextResponse.json({ error: 'Missing invite or verification token' }, { status: 400 });
    }

    initAdmin();
    const repository = new FamilyRepository();

    const invite = await repository.getInviteByToken(inviteToken);
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found', code: 'invite/not-found' }, { status: 404 });
    }

    if (invite.status === 'expired') {
      return NextResponse.json({ error: 'Invite expired', code: 'invite/expired' }, { status: 410 });
    }

    if (invite.status === 'revoked') {
      return NextResponse.json({ error: 'Invite revoked', code: 'invite/revoked' }, { status: 410 });
    }

    let pendingRequest;
    try {
      pendingRequest = await repository.verifySignupRequest(verificationToken);
    } catch (error) {
      console.warn('[invite][verify] token reuse or invalid', {
        inviteToken,
        verificationToken,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error: 'Invite link already used',
          code: 'invite/already-verified',
        },
        { status: 409 },
      );
    }
    if (!pendingRequest || pendingRequest.source !== 'invite') {
      return NextResponse.json({ error: 'Invalid verification token', code: 'invite/invalid-verification' }, { status: 400 });
    }

    if (pendingRequest.inviteToken && pendingRequest.inviteToken !== invite.token) {
      return NextResponse.json({ error: 'Verification token does not match invite', code: 'invite/mismatch' }, { status: 400 });
    }

    if (pendingRequest.siteId !== invite.siteId) {
      return NextResponse.json({ error: 'Verification token does not match site', code: 'invite/wrong-site' }, { status: 400 });
    }

    if (!pendingRequest.userId) {
      console.warn('[invite][verify] missing userId on pending request', { inviteToken, verificationToken });
      return NextResponse.json({ error: 'Pending invite is missing user information' }, { status: 500 });
    }

    let verifiedRequest;
    try {
      verifiedRequest = await repository.verifySignupRequest(verificationToken, pendingRequest.userId);
      await repository.updateSignupRequestEmailVerified(verifiedRequest.id);
    } catch (error) {
      console.warn('[invite][verify] token consumed before completion', {
        inviteToken,
        verificationToken,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error: 'Invite link already used',
          code: 'invite/already-verified',
        },
        { status: 409 },
      );
    }

    let userRecord;
    try {
      userRecord = await adminAuth().getUser(pendingRequest.userId);
    } catch (err) {
      userRecord = await adminAuth().getUserByEmail(pendingRequest.email);
    }

    if (!userRecord) {
      userRecord = await adminAuth().createUser({
        uid: pendingRequest.userId,
        email: pendingRequest.email,
        displayName: pendingRequest.firstName || pendingRequest.email,
      });
    }

    const providerIds = userRecord.providerData?.map((p) => p?.providerId).filter(Boolean) ?? [];
    const hasPasswordProvider = providerIds.includes('password');
    const hasGoogleProvider = providerIds.includes('google.com');
    const needsCredentialSetup = !(hasPasswordProvider || hasGoogleProvider);

    const member = await repository.acceptInvite(invite.token, {
      uid: userRecord.uid,
      siteId: invite.siteId,
      email: userRecord.email || pendingRequest.email,
      displayName: userRecord.displayName || pendingRequest.firstName || pendingRequest.email,
      firstName: pendingRequest.firstName || userRecord.displayName || pendingRequest.email,
    });

    await repository.markSignupRequestApproved(verifiedRequest.id);

    const customToken = await adminAuth().createCustomToken(userRecord.uid, {
      inviteSiteId: invite.siteId,
    });

    const claims = {
      userId: userRecord.uid,
      siteId: invite.siteId,
      role: member.role || 'member',
      firstName: member.firstName || member.displayName || pendingRequest.firstName || '',
      lastName: '',
      email: userRecord.email || pendingRequest.email,
      needsCredentialSetup,
    } as const;

    const access = signAccessToken(claims, 10);
    const refresh = signRefreshToken(claims, 30);
    const response = NextResponse.json({
      success: true,
      customToken,
      member,
      needsCredentialSetup,
    });
    setAuthCookies(response, access, refresh);
    return response;
  } catch (error) {
    console.error('[invite][verify] failed to verify invite', error);
    return NextResponse.json({ error: 'Failed to verify invite' }, { status: 500 });
  }
}
