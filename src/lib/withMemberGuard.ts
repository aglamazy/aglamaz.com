import { NextResponse } from 'next/server';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/auth/service';
import { MemberRepository } from '@/repositories/MemberRepository';
import { RouteHandler, GuardContext } from '../app/api/types';

let memberRepository: MemberRepository | null = null;
let getCookies = cookies;

export function __setMockCookies(fn: typeof cookies) {
  getCookies = fn;
}

export function __setMockMemberRepository(repo: MemberRepository | null) {
  memberRepository = repo;
}

export function withMemberGuard(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      if (!memberRepository) {
        memberRepository = new MemberRepository();
      }
      const cookieStore = getCookies();
      const token = cookieStore.get(ACCESS_TOKEN)?.value;
      const payload = token && verifyAccessToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Unauthorized (withMG, np)' }, { status: 401 });
      }
      const uid = payload.sub;
      if (!uid) {
        return NextResponse.json({ error: 'Unauthorized (withMG)' }, { status: 401 });
      }

      context.user = payload;
      const siteId = context.params?.siteId || process.env.NEXT_SITE_ID!;
      const member = await memberRepository.getByUid(siteId, uid);

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
