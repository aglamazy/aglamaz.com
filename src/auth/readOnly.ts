import { signJwt, verifyJwt } from './jwt';
import type { LocalizedMemberRecord } from '@/repositories/MemberRepository';
import type { TokenClaims } from './tokens';
import {
  READ_ONLY_AUDIENCE,
  READ_ONLY_TOKEN_TTL_SECONDS,
  isReadOnlyAccessTokenClaims,
  type ReadOnlyAccessTokenClaims,
} from './readOnlyShared';

export function signReadOnlyAccessToken(params: { memberId: string; siteId: string }): string {
  const claims: ReadOnlyAccessTokenClaims = {
    sub: params.memberId,
    aud: READ_ONLY_AUDIENCE,
    userId: params.memberId,
    siteId: params.siteId,
    role: 'member',
    firstName: '',
    memberId: params.memberId,
    scope: 'read-only',
  };

  return signJwt(claims as TokenClaims, {
    expiresInSec: READ_ONLY_TOKEN_TTL_SECONDS,
    audience: READ_ONLY_AUDIENCE,
    subject: params.memberId,
  });
}

export function verifyReadOnlyAccessToken(token: string): ReadOnlyAccessTokenClaims | null {
  const payload = verifyJwt(token, { checkAud: READ_ONLY_AUDIENCE });
  if (!payload) {
    return null;
  }

  if (!isReadOnlyAccessTokenClaims(payload)) {
    return null;
  }

  return payload;
}

export function buildReadOnlyUserClaims(member: LocalizedMemberRecord): TokenClaims {
  const resolvedUserId = member.uid || member.id;
  return {
    sub: resolvedUserId,
    aud: READ_ONLY_AUDIENCE,
    userId: resolvedUserId,
    siteId: member.siteId,
    role: member.role,
    firstName: member.firstName || member.displayName || '',
    lastName: member.lastName || undefined,
    email: member.email || undefined,
    name: member.displayName || undefined,
    picture: member.avatarUrl || undefined,
  };
}

export function buildReadOnlyAccessLink(origin: string, href: string, token: string): string {
  const url = new URL(href, origin);
  url.searchParams.set('rt', token);
  return url.toString();
}
