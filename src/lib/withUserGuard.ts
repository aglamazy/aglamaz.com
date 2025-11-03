import { NextResponse } from 'next/server';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/auth/service';
import { RouteHandler, GuardContext } from '../app/api/types';

let getCookies = cookies;

export function __setMockCookies(fn: typeof cookies) {
  getCookies = fn;
}

export function withUserGuard(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      const cookieStore = await getCookies();
      const token = cookieStore.get(ACCESS_TOKEN)?.value;
      const payload = token && verifyAccessToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Unauthorized (withUG)' }, { status: 401 });
      }
      context.user = payload;
      return handler(request, context);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Unauthorized (withUG, error)' }, { status: 401 });
    }
  };
}
