import { NextRequest, NextResponse } from 'next/server';
import { initAdmin, adminAuth } from '@/firebase/admin';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { sentMessageRepository } from '@/repositories/SentMessageRepository';
import { adminNotificationService } from '@/services/AdminNotificationService';
import { loginAuditRepository } from '@/repositories/LoginAuditRepository';
import { signAccessToken, signRefreshToken } from '@/auth/service';
import { setAuthCookies } from '@/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    initAdmin();
    const decoded = await adminAuth().verifyIdToken(idToken);
    const appClaims = {
      userId: decoded.uid,
      siteId: process.env.NEXT_SITE_ID || '',
      role: (decoded as any).role || 'member',
      firstName: (decoded as any).name || '',
      lastName: '',
      email: decoded.email || '',
      needsCredentialSetup: false,
    };
    const access = signAccessToken(appClaims);
    const refresh = signRefreshToken(appClaims);

    const res = NextResponse.json({ token: access });
    setAuthCookies(res, access, refresh);

    // Side-effect: who+when audit trail (Agla, 2026-07-24). Must not block login.
    if (appClaims.siteId) {
      loginAuditRepository
        .record({
          siteId: appClaims.siteId,
          memberId: decoded.uid,
          email: appClaims.email,
          provider: (decoded as any).firebase?.sign_in_provider || 'unknown',
        })
        .catch((e) => console.error('login audit record failed', e));
    }

    // Side-effect: if a signup request exists for this user/site, ping admin at most once per 24h
    // This must not block login; errors are logged only.
    (async () => {
      try {
        const siteId = appClaims.siteId;
        const email = decoded.email?.toLowerCase().trim();
        const firstName = (decoded as any).name || '';
        if (!siteId || !email) return;
        const fam = new FamilyRepository();
        const reqDoc = await fam.getSignupRequestByEmail(email, siteId);
        if (!reqDoc) return;
        const status = (reqDoc as any).status;
        if (status && status !== 'pending' && status !== 'pending_verification') {
          return;
        }
        const key = `${siteId}_${email}`;
        const dayMs = 24 * 60 * 60 * 1000;
        const should = await sentMessageRepository.shouldSend('pending_member_reminder', key, dayMs);
        if (!should) return;
        await adminNotificationService.notify('pending_member', { firstName, email, siteId });
        await sentMessageRepository.markSent('pending_member_reminder', key);
      } catch (e) {
        console.error('post-login notify failed', e);
      }
    })();
    return res;
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ error: 'Unauthorized (login)' }, { status: 401 });
  }
}
