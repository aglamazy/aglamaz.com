import { signJwt, verifyJwt } from '@/auth/jwt';
import type { TokenClaims } from '@/auth/tokens';
import { ApiRoute, getApiPath } from '@/utils/urls';

/**
 * Every outgoing email send type that carries an open/click tracking token.
 * Kept as a closed union (not a bare string) so a new send path is a deliberate,
 * type-checked addition here rather than an unnoticed typo'd string.
 */
export type EmailTrackingSendType =
  | 'digest'
  | 'in-day-reminder'
  | 'tag-notification'
  | 'blessing-invite'
  | 'blog-review-decision'
  | 'blog-autogen-admin';

export interface EmailTrackingTokenClaims extends TokenClaims {
  recipientMemberId: string;
  sendType: EmailTrackingSendType;
  /** Groups events from the same logical send (e.g. a digest period, a day's reminder batch) - not itself the source of per-copy uniqueness (recipientMemberId is). */
  sendId: string;
}

const EMAIL_TRACKING_AUDIENCE = 'email-tracking';
// Generous TTL (~13 months) - unlike an auth session, a tracking pixel/link must keep
// working for as long as the recipient might still open an old email in their inbox.
const EMAIL_TRACKING_TTL_SECONDS = 400 * 24 * 60 * 60;

const SEND_TYPES: readonly EmailTrackingSendType[] = [
  'digest',
  'in-day-reminder',
  'tag-notification',
  'blessing-invite',
  'blog-review-decision',
  'blog-autogen-admin',
];

function isEmailTrackingSendType(value: unknown): value is EmailTrackingSendType {
  return typeof value === 'string' && (SEND_TYPES as readonly string[]).includes(value);
}

export interface EmailTrackingIdentity {
  siteId: string;
  recipientMemberId: string;
  sendType: EmailTrackingSendType;
  sendId: string;
}

/** Signs a per-copy tracking token - one per (siteId, recipientMemberId, sendType, sendId) combination, i.e. unique per email copy. */
export function signEmailTrackingToken(params: EmailTrackingIdentity): string {
  const claims: EmailTrackingTokenClaims = {
    sub: params.recipientMemberId,
    aud: EMAIL_TRACKING_AUDIENCE,
    userId: params.recipientMemberId,
    siteId: params.siteId,
    role: 'member',
    firstName: '',
    recipientMemberId: params.recipientMemberId,
    sendType: params.sendType,
    sendId: params.sendId,
  };

  return signJwt(claims as TokenClaims, {
    expiresInSec: EMAIL_TRACKING_TTL_SECONDS,
    audience: EMAIL_TRACKING_AUDIENCE,
    subject: params.recipientMemberId,
  });
}

/** Verifies a tracking token. Returns null for anything malformed/tampered/expired - callers must never let a bad token break the surrounding email/redirect behavior. */
export function verifyEmailTrackingToken(token: string): EmailTrackingTokenClaims | null {
  const payload = verifyJwt(token, { checkAud: EMAIL_TRACKING_AUDIENCE });
  if (!payload) return null;

  if (
    typeof payload.userId !== 'string' ||
    !payload.userId.trim() ||
    typeof payload.siteId !== 'string' ||
    !payload.siteId.trim() ||
    payload.sub !== payload.userId ||
    typeof (payload as EmailTrackingTokenClaims).sendId !== 'string' ||
    !(payload as EmailTrackingTokenClaims).sendId.trim() ||
    !isEmailTrackingSendType((payload as EmailTrackingTokenClaims).sendType)
  ) {
    return null;
  }

  return payload as EmailTrackingTokenClaims;
}

/** Builds the absolute pixel-fetch URL for a signed token, rooted at the given site origin. */
export function buildPixelTrackingUrl(origin: string, token: string): string {
  return new URL(getApiPath(ApiRoute.TRACK_PIXEL, '', { token }), origin).toString();
}

/** Builds the absolute click-tracking redirect URL for a signed token + real destination. */
export function buildClickTrackingUrl(origin: string, token: string, destinationUrl: string): string {
  const url = new URL(getApiPath(ApiRoute.TRACK_CLICK, '', { token }), origin);
  url.searchParams.set('u', destinationUrl);
  return url.toString();
}
