// Public, unauthenticated-by-design (the signed token IS the auth - same pattern as
// /api/review/[token]) open-tracking pixel: every outgoing email embeds an <img> pointing
// here at a unique per-copy URL (src/services/ResendService.ts's sendTransactionalEmail
// mints + injects it). A GET here means a mail client actually rendered/fetched this
// specific copy - that's the "opened" signal.
//
// CAVEAT (must always be true, never just for the happy path): a bad/tampered/expired
// token must still return a real image - never break email rendering - it just skips the
// Firestore log. See docs/family-digest-formats-spec.md's OPEN-analytics task for the
// Gmail image-proxy caveat: Gmail's own image proxy caches the fetched image, so a SECOND
// open by the same recipient may serve Gmail's cached copy instead of re-hitting this route
// - "opened" data reflects first-opens reliably, re-opens undercount by design of Gmail's
// proxy, not a bug here.
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyEmailTrackingToken } from '@/services/EmailTrackingService';
import { emailTrackingRepository } from '@/repositories/EmailTrackingRepository';

export const dynamic = 'force-dynamic';

// Reused as the pixel image itself - an existing site image (the logo), not a bespoke
// blank GIF, per the task's "don't change the email's look" framing. Forced to 1x1 via
// the <img> tag's own width/height/style attributes (see emailTemplates.ts's injectTrackingPixel),
// so its real dimensions never matter.
const PIXEL_IMAGE_PATH = path.join(process.cwd(), 'public', 'favicon.svg');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const claims = verifyEmailTrackingToken(token);

  if (claims) {
    try {
      await emailTrackingRepository.logEvent({
        siteId: claims.siteId,
        recipientMemberId: claims.recipientMemberId,
        sendType: claims.sendType,
        sendId: claims.sendId,
        eventType: 'open',
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
    } catch (err) {
      // Never let a logging failure break the image response.
      console.error('[track/pixel] failed to log open event:', err);
    }
  }

  const image = fs.readFileSync(PIXEL_IMAGE_PATH);
  return new Response(image, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  });
}
