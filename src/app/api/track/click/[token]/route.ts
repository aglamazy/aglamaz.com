// Public, unauthenticated-by-design (the signed token IS the auth - same pattern as
// /api/review/[token] and the pixel route next to this one) per-copy click tracker: a
// link's real destination is wrapped in this URL (EmailTrackingService.buildClickTrackingUrl)
// so a GET here logs a "clicked" event before 302-redirecting to the real destination.
//
// Security: `u` (the destination) is an attacker-controlled query param on an
// unauthenticated route - without a check this would be an open redirect using our own
// domain. Only same-origin destinations are honored; anything else is refused outright
// rather than "helpfully" redirecting somewhere unexpected.
import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailTrackingToken } from '@/services/EmailTrackingService';
import { emailTrackingRepository } from '@/repositories/EmailTrackingRepository';

export const dynamic = 'force-dynamic';

function resolveSafeRedirectTarget(request: NextRequest, rawDestination: string | null): string | null {
  if (!rawDestination) return null;
  try {
    const destination = new URL(rawDestination);
    if (destination.origin !== request.nextUrl.origin) return null;
    return destination.toString();
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const destination = resolveSafeRedirectTarget(request, request.nextUrl.searchParams.get('u'));

  if (!destination) {
    return NextResponse.json({ error: 'Missing or invalid destination' }, { status: 400 });
  }

  const claims = verifyEmailTrackingToken(token);
  if (claims) {
    try {
      await emailTrackingRepository.logEvent({
        siteId: claims.siteId,
        recipientMemberId: claims.recipientMemberId,
        sendType: claims.sendType,
        sendId: claims.sendId,
        eventType: 'click',
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
    } catch (err) {
      // Never let a logging failure break the redirect - the recipient still needs to land.
      console.error('[track/click] failed to log click event:', err);
    }
  }

  return NextResponse.redirect(destination, { status: 302 });
}
