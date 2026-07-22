import { NextResponse } from 'next/server';
import {
  getUserFromToken,
  getMemberFromToken,
  getMemberFromReadToken,
  __setMockCookies as __setMockCookiesUtil,
  __setMockMemberRepository as __setMockMemberRepositoryUtil,
} from '@/utils/serverAuth';
import { MemberRepository } from '@/repositories/MemberRepository';
import { RouteHandler, GuardContext } from '../app/api/types';
import { cookies } from 'next/headers';

export function __setMockCookies(fn: typeof cookies) {
  __setMockCookiesUtil(fn);
}

export function __setMockMemberRepository(repo: MemberRepository | null) {
  __setMockMemberRepositoryUtil(repo);
}

/**
 * Read-only counterpart to withMemberGuard (src/lib/withMemberGuard.ts). A real Firebase
 * session gets the full member context exactly like withMemberGuard. Absent a session, a
 * valid signed `rt` query-param read-token (docs/family-digest-formats-spec.md §7) resolves
 * a read-only member context of the SAME shape (context.member), so handlers/pages don't
 * need special-case branching.
 *
 * SECURITY: only wrap GET/read handlers with this. It intentionally does not distinguish a
 * real session from a token-derived one in the context it hands the handler, so any handler
 * wrapped here must treat context.member as read-only and never perform a write from it.
 * Write routes must keep using withMemberGuard/withUserGuard, which never look at `rt`.
 */
export function withReadableGuard(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      const payload = await getUserFromToken();
      const params = context.params instanceof Promise ? await context.params : context.params;
      const siteId = params?.siteId || process.env.NEXT_SITE_ID!;

      if (payload?.sub) {
        const member = await getMemberFromToken(siteId);
        if (!member) {
          return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }
        context.user = payload;
        context.member = member;
        return handler(request, context);
      }

      const rt = new URL(request.url).searchParams.get('rt');
      const member = await getMemberFromReadToken(siteId, rt);
      if (!member) {
        return NextResponse.json({ error: 'Unauthorized (withRG)' }, { status: 401 });
      }

      context.member = member;
      return handler(request, context);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Unauthorized (withRG, error)' }, { status: 401 });
    }
  };
}
