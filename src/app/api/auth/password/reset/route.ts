import { NextRequest, NextResponse } from 'next/server';
import type { ActionCodeSettings } from 'firebase-admin/auth';
import { initAdmin, adminAuth } from '@/firebase/admin';
import { GmailService } from '@/services/GmailService';

export const dynamic = 'force-dynamic';

const RESET_ERROR_MESSAGE = 'Failed to send password reset email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, locale } = body as { email?: string; locale?: string };

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    initAdmin();
    const auth = adminAuth();

    try {
      const userRecord = await auth.getUserByEmail(normalizedEmail);

      const continueBase = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL;
      let actionSettings: ActionCodeSettings | undefined;
      if (continueBase) {
        const url = new URL(continueBase);
        url.pathname = '/login';
        actionSettings = {
          url: url.toString(),
          handleCodeInApp: true,
        };
      }

      const resetLink = await auth.generatePasswordResetLink(normalizedEmail, actionSettings);
      const gmail = await GmailService.init();
      await gmail.sendPasswordResetEmail({
        to: normalizedEmail,
        resetUrl: resetLink,
        firstName: userRecord.displayName || undefined,
        language: locale,
      });
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') {
        console.warn('[auth][password-reset] email not found, returning success');
        return NextResponse.json({ success: true });
      }
      console.error('[auth][password-reset] Firebase error', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth][password-reset] failed to process request', error);
    return NextResponse.json({ error: RESET_ERROR_MESSAGE }, { status: 500 });
  }
}
