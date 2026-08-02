import { NextResponse } from 'next/server';
import {
  getUserFromToken,
  getMemberFromToken,
  getMemberFromReadToken,
  getRtSessionCookie,
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
 * valid signed read-token (docs/family-digest-formats-spec.md §7) resolves a read-only
 * member context of the SAME shape (context.member), so handlers/pages don't need
 * special-case branching. The token can arrive either as a `?rt=` query param (the raw
 * magazine-link click) or the `RT_SESSION` cookie src/proxy.ts sets from that param on
 * the first hit - client-side fetches after the initial page load only carry the cookie.
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

      // The `rt` query param only exists on the FIRST navigation to a magazine link
      // (src/proxy.ts strips it after minting the RT_SESSION cookie) - every
      // subsequent same-page client-side fetch (e.g. this route, called on calendar
      // mount) carries no `rt` param at all, only the cookie. Falling back to the
      // cookie here is what src/app/app/layout.tsx already does for the page-level
      // SSR check; this guard needs the same fallback or every read-only API call
      // 401s once the URL's `rt` is gone, which apiFetch then turns into a hard
      // redirect to the landing page (Agla, 2026-08-02 - "shows a notice on top, but
      // redirects to /he").
      const rtFromQuery = new URL(request.url).searchParams.get('rt');
      const rt = rtFromQuery ?? (await getRtSessionCookie());
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
