import { NextResponse } from 'next/server';
import {
  getUserFromToken,
  getMemberFromToken,
  getMemberFromReadToken,
  __setMockCookies as __setMockCookiesUtil,
  __setMockMemberRepository as __setMockMemberRepositoryUtil,
} from '@/utils/serverAuth';
import { MemberRepository } from '@/repositories/MemberRepository';
import type { LocalizedMemberRecord } from '@/repositories/MemberRepository';
import { RouteHandler, GuardContext } from '../app/api/types';
import { cookies } from 'next/headers';

export function __setMockCookies(fn: typeof cookies) {
  __setMockCookiesUtil(fn);
}

export function __setMockMemberRepository(repo: MemberRepository | null) {
  __setMockMemberRepositoryUtil(repo);
}

/**
 * Guard for read-only routes that must be accessible from email links.
 *
 * Auth priority:
 *   1. Real Firebase session (access_token cookie) — full member context
 *   2. Read token (?rt=<token> query param) — same member context shape, read-only
 *
 * Write routes must continue to use withMemberGuard (not this function).
 */
export function withReadTokenGuard(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      const params = context.params instanceof Promise ? await context.params : context.params;
      const siteId = params?.siteId || process.env.NEXT_SITE_ID!;

      // 1. Try real session first
      const sessionPayload = await getUserFromToken();
      if (sessionPayload?.sub) {
        const member = await getMemberFromToken(siteId);
        if (!member) {
          return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }
        context.user = sessionPayload;
        context.member = member;
        return handler(request, context);
      }

      // 2. Fall back to read token in ?rt= query param
      const url = new URL(request.url);
      const rt = url.searchParams.get('rt');
      if (!rt) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const member = await getMemberFromReadToken(rt, siteId) as LocalizedMemberRecord | null;
      if (!member) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Synthesize user context from member data — same TokenClaims shape as the real session
      context.user = {
        sub: member.uid,
        userId: member.uid,
        siteId,
        role: member.role,
        firstName: member.firstName,
        lastName: member.lastName ?? undefined,
        email: member.email,
      };
      context.member = member;
      return handler(request, context);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  };
}
