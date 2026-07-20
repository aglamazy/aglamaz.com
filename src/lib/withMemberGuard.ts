import { NextResponse } from 'next/server';
import { getMemberAuthContext, __setMockCookies as __setMockCookiesUtil, __setMockMemberRepository as __setMockMemberRepositoryUtil } from '@/utils/serverAuth';
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
      const method = request.method.toUpperCase();
      const allowReadOnly = method === 'GET' || method === 'HEAD';
      const params = context.params instanceof Promise ? await context.params : context.params;
      const siteId = params?.siteId || process.env.NEXT_SITE_ID!;
      const authContext = await getMemberAuthContext(siteId, { allowReadOnly });

      if (!authContext) {
        return NextResponse.json({ error: 'Unauthorized (withMG, np)' }, { status: 401 });
      }

      if (!allowReadOnly && authContext.readOnly) {
        return NextResponse.json({ error: 'Unauthorized (withMG, np)' }, { status: 401 });
      }

      context.user = authContext.user;
      context.member = authContext.member;
      context.readOnly = authContext.readOnly;
      return handler(request, context);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Unauthorized (withMG, error)' }, { status: 401 });
    }
  };
}
