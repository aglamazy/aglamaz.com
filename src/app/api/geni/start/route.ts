import { NextRequest, NextResponse } from 'next/server';
import { createAuthUrl, GENI_STATE, getOrigin } from '@/integrations/geni';

export async function GET(req: NextRequest) {
  try {
    const origin = getOrigin(req);
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const url = createAuthUrl(origin, state);
    const res = NextResponse.redirect(url, 302);
    res.cookies.set(GENI_STATE, state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300 });
    return res;
  } catch (err) {
    // local handling + rethrow per policy
    console.error('GENI start error:', err);
    throw err;
  }
}
