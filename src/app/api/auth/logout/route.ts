import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies } from '@/auth/cookies';
import { landingPage } from "@/app/settings";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = new URL(landingPage, req.nextUrl.origin);
  const res = NextResponse.redirect(url, 303);
  clearAuthCookies(res);
  return res;
}
