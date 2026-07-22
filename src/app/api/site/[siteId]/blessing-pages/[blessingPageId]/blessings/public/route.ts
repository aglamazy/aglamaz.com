import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { BlessingRepository } from '@/repositories/BlessingRepository';
import { adminNotificationService, NotificationEventType } from '@/services/AdminNotificationService';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// This is a DELIBERATELY separate, scoped-down write path — not the member
// blessing-create route with auth stripped off. Unlike every other create/
// update route in this app, this one is reachable with no session at all, so
// it re-verifies the blessing page's public-ness itself (withMemberGuard
// would 401 before we ever get the chance), forces visibleToPublic/
// isNonMemberContribution rather than trusting client input, and applies its
// own anti-abuse checks (rate limit + honeypot/timing heuristic) that member
// routes don't need.

const AUTHOR_NAME_MAX_LENGTH = 100;
const CONTENT_MAX_LENGTH = 5000;
const EMAIL_MAX_LENGTH = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_PER_PAGE = { limit: 3, windowMs: 10 * 60 * 1000 }; // 3 posts per page per IP / 10 min
const RATE_LIMIT_PER_IP = { limit: 10, windowMs: 10 * 60 * 1000 }; // 10 posts total per IP / 10 min

// Test-only injection hooks, mirroring the __setMock* convention used by
// withMemberGuard.ts — lets tests avoid touching real Firestore/Gmail.
let blessingPageRepoOverride: BlessingPageRepository | null = null;
let blessingRepoOverride: BlessingRepository | null = null;
let notifyOverride: ((eventType: NotificationEventType, payload: any, siteUrl?: string) => Promise<any>) | null = null;

export function __setMockBlessingPageRepository(repo: BlessingPageRepository | null) {
  blessingPageRepoOverride = repo;
}
export function __setMockBlessingRepository(repo: BlessingRepository | null) {
  blessingRepoOverride = repo;
}
export function __setMockNotify(fn: typeof notifyOverride) {
  notifyOverride = fn;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ siteId: string; blessingPageId: string }> }
) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const blessingPageId = params?.blessingPageId;

    if (!siteId || !blessingPageId) {
      return Response.json({ error: 'Site ID and blessing page ID are required' }, { status: 400 });
    }

    // Public-ness check FIRST and independent of body validation, so a
    // private page's write endpoint never leaks anything beyond "not found".
    const bpRepo = blessingPageRepoOverride ?? new BlessingPageRepository();
    const blessingPage = await bpRepo.getById(blessingPageId);
    if (!blessingPage || blessingPage.siteId !== siteId || !blessingPage.isPublic) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    const ip = getClientIp(request);
    const perPage = checkRateLimit(`page:${blessingPageId}:${ip}`, RATE_LIMIT_PER_PAGE);
    const perIp = checkRateLimit(`ip:${ip}`, RATE_LIMIT_PER_IP);
    if (!perPage.allowed || !perIp.allowed) {
      return Response.json({ error: 'Too many submissions, please try again later' }, { status: 429 });
    }

    const body = await request.json();
    const { authorName, guestEmail, content, honeyputValue, timeToSubmitMs } = body;

    if (!authorName || typeof authorName !== 'string' || !authorName.trim()) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }
    if (authorName.trim().length > AUTHOR_NAME_MAX_LENGTH) {
      return Response.json({ error: 'Name is too long' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }
    if (content.trim().length > CONTENT_MAX_LENGTH) {
      return Response.json({ error: 'Content is too long' }, { status: 400 });
    }
    if (guestEmail !== undefined && guestEmail !== '') {
      if (typeof guestEmail !== 'string' || guestEmail.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(guestEmail)) {
        return Response.json({ error: 'Email is invalid' }, { status: 400 });
      }
    }

    // Honeypot/timing spam heuristic, mirrored from the public contact form
    // (src/app/api/site/[siteId]/contact/route.ts) since there's no rate-limit
    // infra to lean on beyond the counters above.
    let spamProbability = 0;
    if (typeof honeyputValue === 'string' && honeyputValue.trim().length > 0) {
      spamProbability += 50;
    }
    if (typeof timeToSubmitMs === 'number') {
      if (timeToSubmitMs <= 2000) spamProbability += 25;
      if (timeToSubmitMs <= 1000) spamProbability += 25;
    }
    if (spamProbability >= 50) {
      console.log('[public blessing] blocked suspected spam submission', {
        blessingPageId,
        ip,
        honeyputValue,
        timeToSubmitMs,
        spamProbability,
      });
      // Respond as if it succeeded, same as the contact form, so a bot gets
      // no signal that it was filtered.
      return Response.json({ success: true }, { status: 201 });
    }

    const trimmedName = authorName.trim();
    const trimmedEmail = typeof guestEmail === 'string' ? guestEmail.trim() : undefined;
    const trimmedContent = content.trim();
    // Guest content is plain text, not TinyMCE rich text — escape it before
    // storing since it's rendered elsewhere via dangerouslySetInnerHTML and
    // an anonymous, unauthenticated writer is exactly the XSS threat model
    // that member-authored (trusted-editor) content doesn't have to worry about.
    const safeContent = escapeHtml(trimmedContent).replace(/\n/g, '<br />');

    const locale = request.headers.get('x-locale') || 'he';

    const blessingRepo = blessingRepoOverride ?? new BlessingRepository();
    const blessing = await blessingRepo.create({
      blessingPageId,
      siteId,
      authorId: '',
      authorName: trimmedName,
      content: safeContent,
      locale,
      // A non-member has no "member-only" audience to write for — force public.
      visibleToPublic: true,
      isNonMemberContribution: true,
      guestEmail: trimmedEmail,
    });

    const origin = new URL(request.url).origin;
    const notify = notifyOverride ?? adminNotificationService.notify.bind(adminNotificationService);
    await notify(
      'guest_blessing',
      {
        siteId,
        authorName: trimmedName,
        content: trimmedContent,
        guestEmail: trimmedEmail,
      },
      origin
    ).catch((err) => console.error('[public blessing] admin notification failed:', err));

    return Response.json({ blessing }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create blessing' }, { status: 500 });
  }
};
