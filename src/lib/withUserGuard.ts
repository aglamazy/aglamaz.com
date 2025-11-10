import { NextResponse } from 'next/server';
import { getUserFromToken, __setMockCookies as __setMockCookiesUtil } from '@/utils/serverAuth';
import { RouteHandler, GuardContext } from '../app/api/types';
import { cookies } from 'next/headers';

export function __setMockCookies(fn: typeof cookies) {
  __setMockCookiesUtil(fn);
}

export function withUserGuard(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      const payload = await getUserFromToken();
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
