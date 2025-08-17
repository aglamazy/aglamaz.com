import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const url = new URL('/login', req.nextUrl.origin);
  const res = NextResponse.redirect(url, 303);
  clearAuthCookies(res);
  return res;
}