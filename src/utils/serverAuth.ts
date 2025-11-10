import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { MemberRepository } from '@/repositories/MemberRepository';
import type { LocalizedMemberRecord } from '@/repositories/MemberRepository';
import type { TokenClaims } from '@/auth/tokens';

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
