import { NextRequest, NextResponse } from 'next/server';
import { FamilyRepository } from '../../../../repositories/FamilyRepository';
import { GmailService } from '../../../../services/GmailService';
import { getUrl, AppRoute } from '@/utils/serverUrls';
import { shouldAutoApprove } from '@/utils/siteUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, email, siteId, language } = body;

    if (!firstName || !email || !siteId) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, email, siteId' },
        { status: 400 }
      );
    }

    const locale = language || 'en';
    const familyRepository = new FamilyRepository();
    const origin = new URL(request.url).origin;

    // Check if this is a demo site — if so, auto-verify and auto-approve with no email step
    const site = await familyRepository.getSite(siteId);
    if (shouldAutoApprove(site)) {
      const signupRequest = await familyRepository.createSignupRequest(
        { firstName, email, siteId, status: 'pending_verification' },
        origin,
        { skipNotification: true }
      );
      await familyRepository.processSignupRequest(signupRequest.id, 'system', true);
      return NextResponse.json({ success: false, autoApproved: true });
    }

    // Standard flow: create verification token and send email
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await familyRepository.createSignupRequest({
      firstName,
      email,
      siteId,
      verificationToken,
      expiresAt,
      status: 'pending_verification'
    }, origin);

    // Send verification email
    const verificationUrl = await getUrl(
      AppRoute.AUTH_SIGNUP_VERIFY,
      siteId,
      undefined,
      { token: verificationToken }
    );

    try {
      const gmailService = await GmailService.init();
      await gmailService.sendVerificationEmail(email, firstName, verificationUrl, locale);

      // Mark email_verified flag on the signup request doc
      const emailKey = email.toLowerCase().trim();
      const documentKey = `${emailKey}_${siteId}`;
      const crypto = require('crypto');
      const documentId = crypto.createHash('sha256').update(documentKey).digest('hex');

      await familyRepository.updateSignupRequestEmailVerified(documentId);

    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully',
      data: {
        email
      }
    });

  } catch (error) {
    console.error('Verification request error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}
