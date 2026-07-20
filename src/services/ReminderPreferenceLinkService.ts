import { signJwt, verifyJwt } from '@/auth/jwt';
import type { TokenClaims } from '@/auth/tokens';
import { ApiRoute, getApiPath } from '@/utils/urls';

export type ReminderPreferenceTopic = 'birthday' | 'yahrzeit';

export interface ReminderPreferenceTokenClaims extends TokenClaims {
  topic: ReminderPreferenceTopic;
}

const REMINDER_PREFERENCES_AUDIENCE = 'notification-preferences';
const REMINDER_PREFERENCES_TTL_SECONDS = 14 * 24 * 60 * 60;

function isReminderPreferenceTopic(topic: unknown): topic is ReminderPreferenceTopic {
  return topic === 'birthday' || topic === 'yahrzeit';
}

export function signReminderPreferenceToken(params: {
  memberId: string;
  siteId: string;
  topic: ReminderPreferenceTopic;
}): string {
  const claims: ReminderPreferenceTokenClaims = {
    sub: params.memberId,
    aud: REMINDER_PREFERENCES_AUDIENCE,
    userId: params.memberId,
    siteId: params.siteId,
    role: 'member',
    firstName: '',
    topic: params.topic,
  };

  return signJwt(claims as TokenClaims, {
    expiresInSec: REMINDER_PREFERENCES_TTL_SECONDS,
    audience: REMINDER_PREFERENCES_AUDIENCE,
    subject: params.memberId,
  });
}

export function verifyReminderPreferenceToken(token: string): ReminderPreferenceTokenClaims | null {
  const payload = verifyJwt(token, { checkAud: REMINDER_PREFERENCES_AUDIENCE });
  if (!payload) {
    return null;
  }

  if (
    typeof payload.userId !== 'string' ||
    !payload.userId.trim() ||
    typeof payload.siteId !== 'string' ||
    !payload.siteId.trim() ||
    payload.sub !== payload.userId ||
    !isReminderPreferenceTopic((payload as ReminderPreferenceTokenClaims).topic)
  ) {
    return null;
  }

  return payload as ReminderPreferenceTokenClaims;
}

export function buildReminderPreferenceLink(origin: string, token: string): string {
  const url = new URL(getApiPath(ApiRoute.REMINDER_PREFERENCES, ''), origin);
  url.searchParams.set('token', token);
  return url.toString();
}
