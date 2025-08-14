import { createHash, randomBytes, createSign, createVerify } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export type JwtPayload = { sub: string; roles?: string[]; siteId?: string; exp: number; jti?: string };

// In-memory store for hashed refresh tokens and last refresh timestamps
const refreshStore = new Map<string, string>();
const refreshRateLimit = new Map<string, number>();

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signJwt(payload: object, expiresInSec: number): string {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  if (!privateKey) throw new Error('JWT_PRIVATE_KEY not set');
  const header = { alg: 'RS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = { ...payload, exp };
  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(body));
  const unsigned = `${headerEncoded}.${payloadEncoded}`;
  const sign = createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(privateKey);
  const signatureEncoded = base64url(signature);
  return `${unsigned}.${signatureEncoded}`;
}

function verifyJwt(token: string): JwtPayload | null {
  try {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) throw new Error('JWT_PUBLIC_KEY not set');
    const [h, p, s] = token.split('.');
    const verify = createVerify('RSA-SHA256');
    verify.update(`${h}.${p}`);
    const signature = Buffer.from(s, 'base64');
    if (!verify.verify(publicKey, signature)) return null;
    const payload: JwtPayload = JSON.parse(Buffer.from(p, 'base64').toString());
    const skew = 5; // seconds of allowed clock skew
    if (payload.exp < Math.floor(Date.now() / 1000) - skew) return null;
    return payload;
  } catch (err) {
    console.error('JWT verification failed', err);
    return null;
  }
}

export function signAccessToken(user: { sub: string; roles?: string[]; siteId?: string }) {
  return signJwt(user, 60 * 5); // 5 minutes
}

export function signRefreshToken(user: { sub: string }) {
  const jti = randomBytes(16).toString('hex');
  const token = signJwt({ sub: user.sub, jti }, 60 * 60 * 24 * 7); // 7 days
  refreshStore.set(user.sub, hashToken(token));
  return token;
}

export function verifyAccessToken(token: string) {
  return verifyJwt(token);
}

export function verifyRefreshToken(token: string) {
  const payload = verifyJwt(token);
  if (!payload?.sub) return null;
  const hashed = hashToken(token);
  const stored = refreshStore.get(payload.sub);
  if (stored !== hashed) {
    // Reuse detection
    refreshStore.delete(payload.sub);
    return null;
  }
  return payload;
}

export function rotateRefreshToken(userId: string) {
  return signRefreshToken({ sub: userId });
}

export function revokeRefreshToken(userId: string) {
  refreshStore.delete(userId);
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function setAuthCookies(res: NextResponse, access: string, refresh?: string) {
  res.cookies.set('access_token', access, {
    httpOnly: true,
    secure: true,
    path: '/',
    sameSite: 'lax',
  });
  if (refresh) {
    res.cookies.set('refresh_token', refresh, {
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'lax',
    });
  }
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set('access_token', '', { path: '/', maxAge: 0 });
  res.cookies.set('refresh_token', '', { path: '/', maxAge: 0 });
}

export async function getServerAuth() {
  const cookieStore = cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export function withAuth(
  handler: (req: NextRequest, auth: JwtPayload) => Promise<NextResponse> | NextResponse,
  options?: { role?: string; siteId?: string }
) {
  return async (req: NextRequest) => {
    const token = req.cookies.get('access_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyAccessToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (options?.role && !payload.roles?.includes(options.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (options?.siteId && payload.siteId !== options.siteId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req, payload);
  };
}

export { refreshRateLimit };
