import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { MemberRepository } from '@/repositories/MemberRepository';
import type { LocalizedMemberRecord } from '@/repositories/MemberRepository';
import type { TokenClaims } from '@/auth/tokens';
import { verifyReadToken } from '@/services/ReadTokenService';

let getCookies = cookies;
let memberRepository: MemberRepository | null = null;

/**
 * Mock functions for testing
 */
export function __setMockCookies(fn: typeof cookies) {
  getCookies = fn;
}

export function __setMockMemberRepository(repo: MemberRepository | null) {
  memberRepository = repo;
}

/**
 * Get the current Firebase Auth user's token claims from cookies.
 * Returns null if no token or invalid token.
 * Server-side only.
 */
export async function getUserFromToken(): Promise<TokenClaims | null> {
  try {
    const cookieStore = await getCookies();
    const token = cookieStore.get(ACCESS_TOKEN)?.value;

    if (!token) return null;

    const payload = verifyAccessToken(token);
    return payload;
  } catch (error) {
    console.error('[getUserFromToken] failed', error);
    return null;
  }
}

/**
 * Get the current member document from Firestore using the authenticated user's token.
 * Returns null if no user is authenticated or member document is not found.
 * Server-side only.
 *
 * @param siteId - The site ID to fetch the member from
 */
export async function getMemberFromToken(siteId: string): Promise<LocalizedMemberRecord | null> {
  try {
    const user = await getUserFromToken();
    if (!user?.sub) return null;

    if (!memberRepository) {
      memberRepository = new MemberRepository();
    }

    const member = await memberRepository.getByUid(siteId, user.sub);
    return member;
  } catch (error) {
    console.error('[getMemberFromToken] failed', error);
    return null;
  }
}

/**
 * Get a read-only member document from a signed read-token (docs/family-digest-formats-spec.md
 * §7), without a Firebase Auth session. Returns null if the token is missing, invalid, expired,
 * or scoped to a different site. Server-side only.
 *
 * This is the read-only counterpart to getMemberFromToken above — it must never be used to
 * satisfy a write-capable route's auth check.
 *
 * @param siteId - The site ID the caller is requesting access to
 * @param rawToken - The raw `rt` token from the request, or null if absent
 */
export async function getMemberFromReadToken(
  siteId: string,
  rawToken: string | null,
): Promise<LocalizedMemberRecord | null> {
  try {
    if (!rawToken) return null;
    const claims = verifyReadToken(rawToken);
    if (!claims || claims.siteId !== siteId) return null;

    if (!memberRepository) {
      memberRepository = new MemberRepository();
    }

    const member = await memberRepository.getByUid(siteId, claims.memberId);
    return member;
  } catch (error) {
    console.error('[getMemberFromReadToken] failed', error);
    return null;
  }
}
