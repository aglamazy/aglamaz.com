import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN, READ_ONLY_ACCESS_TOKEN } from '@/auth/cookies';
import { MemberRepository } from '@/repositories/MemberRepository';
import type { LocalizedMemberRecord } from '@/repositories/MemberRepository';
import type { TokenClaims } from '@/auth/tokens';
import { buildReadOnlyUserClaims, verifyReadOnlyAccessToken } from '@/auth/readOnly';
import { isReadOnlyAccessTokenClaims } from '@/auth/readOnlyShared';

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

export interface ResolvedMemberAuthContext {
  user: TokenClaims;
  member: LocalizedMemberRecord;
  readOnly: boolean;
}

async function getReadOnlyTokenFromCookies(): Promise<string | null> {
  const cookieStore = await getCookies();
  return cookieStore.get(READ_ONLY_ACCESS_TOKEN)?.value ?? null;
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

async function getReadOnlyMemberFromToken(siteId: string): Promise<ResolvedMemberAuthContext | null> {
  try {
    const token = await getReadOnlyTokenFromCookies();
    if (!token) return null;

    const payload = verifyReadOnlyAccessToken(token);
    if (!payload || !isReadOnlyAccessTokenClaims(payload) || payload.siteId !== siteId) {
      return null;
    }

    if (!memberRepository) {
      memberRepository = new MemberRepository();
    }

    const member = await memberRepository.getById(payload.memberId);
    if (!member || member.siteId !== siteId) {
      return null;
    }

    return {
      user: buildReadOnlyUserClaims(member),
      member,
      readOnly: true,
    };
  } catch (error) {
    console.error('[getReadOnlyMemberFromToken] failed', error);
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
  const context = await getMemberAuthContext(siteId, { allowReadOnly: false });
  return context?.member ?? null;
}

export async function getMemberAuthContext(
  siteId: string,
  { allowReadOnly = false }: { allowReadOnly?: boolean } = {},
): Promise<ResolvedMemberAuthContext | null> {
  try {
    const user = await getUserFromToken();
    if (user?.sub) {
      if (!memberRepository) {
        memberRepository = new MemberRepository();
      }

      const member = await memberRepository.getByUid(siteId, user.sub);
      if (!member) {
        return null;
      }

      return { user, member, readOnly: false };
    }

    if (!allowReadOnly) {
      return null;
    }

    return getReadOnlyMemberFromToken(siteId);
  } catch (error) {
    console.error('[getMemberAuthContext] failed', error);
    return null;
  }
}
