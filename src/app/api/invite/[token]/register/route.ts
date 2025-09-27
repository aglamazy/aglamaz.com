import { NextResponse } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { GmailService } from '@/services/GmailService';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params?.token;
    if (!token) {
      return NextResponse.json({ error: 'Missing invite token' }, { status: 400 });
    }

    const { name, email, language } = await request.json().catch(() => ({}));
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Missing name or email' }, { status: 400 });
    }

    initAdmin();
    const repo = new FamilyRepository();
    const invite = await repo.getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found', code: 'invite/not-found' }, { status: 404 });
    }

    if (invite.status === 'expired') {
      return NextResponse.json({ error: 'Invite expired', code: 'invite/expired' }, { status: 410 });
    }

    if (invite.status === 'revoked') {
      return NextResponse.json({ error: 'Invite revoked', code: 'invite/revoked' }, { status: 410 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let userRecord;
    try {
      userRecord = await adminAuth().getUserByEmail(normalizedEmail);
      if (name && userRecord.displayName !== name) {
        await adminAuth().updateUser(userRecord.uid, { displayName: name });
        userRecord = await adminAuth().getUser(userRecord.uid);
      }
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        userRecord = await adminAuth().createUser({
          email: normalizedEmail,
          displayName: name,
        });
      } else {
        console.error('[invite][register] failed to load user', err);
        throw err;
      }
    }

    const firstName = name.trim();
    const origin = new URL(request.url).origin;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    const verificationToken = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const locale = typeof language === 'string' ? language : undefined;

    const signupRequest = await repo.createSignupRequest({
      firstName,
      email: normalizedEmail,
      siteId: invite.siteId,
      status: 'pending_verification',
      userId: userRecord.uid,
      source: 'invite',
      inviteToken: invite.token,
      invitationId: invite.id,
      invitedBy: invite.inviterId,
      email_verified: false,
      verificationToken,
      expiresAt,
      language: locale,
    }, origin);

    const verificationUrl = `${baseUrl.replace(/\/$/, '')}/invite/${invite.token}/verify?code=${verificationToken}`;

    try {
      const gmailService = await GmailService.init();
      await gmailService.sendInviteVerificationEmail(normalizedEmail, firstName, verificationUrl, locale);
    } catch (emailError) {
      console.error('[invite][register] failed to send invitation email', emailError);
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      signupRequestId: signupRequest.id,
      status: signupRequest.status,
    });
  } catch (error) {
    console.error('[invite][register] failed', error);
    return NextResponse.json({ error: 'Failed to prepare invite signup' }, { status: 500 });
  }
}
