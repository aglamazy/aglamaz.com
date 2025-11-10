import { NextResponse } from 'next/server';
import { getUserFromToken, getMemberFromToken, __setMockCookies as __setMockCookiesUtil, __setMockMemberRepository as __setMockMemberRepositoryUtil } from '@/utils/serverAuth';
import { MemberRepository } from '@/repositories/MemberRepository';
import { RouteHandler, GuardContext } from '../app/api/types';
import { cookies } from 'next/headers';

export function __setMockCookies(fn: typeof cookies) {
  __setMockCookiesUtil(fn);
}

export function __setMockMemberRepository(repo: MemberRepository | null) {
  __setMockMemberRepositoryUtil(repo);
}

export function withMemberGuard(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      const payload = await getUserFromToken();
      if (!payload) {
        return NextResponse.json({ error: 'Unauthorized (withMG, np)' }, { status: 401 });
      }
      const uid = payload.sub;
      if (!uid) {
        return NextResponse.json({ error: 'Unauthorized (withMG)' }, { status: 401 });
      }

      context.user = payload;
      const params = context.params instanceof Promise ? await context.params : context.params;
      const siteId = params?.siteId || process.env.NEXT_SITE_ID!;
      const member = await getMemberFromToken(siteId);

      if (!member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      context.member = member;
      return handler(request, context);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Unauthorized (withMG, error)' }, { status: 401 });
    }
  };
}
