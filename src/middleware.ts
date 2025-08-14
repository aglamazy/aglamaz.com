import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/contact',
  '/favicon.ico',
  '/_next',
  '/pending-approval',
  '/locales'
];

type JwtPayload = { sub: string; roles?: string[]; siteId?: string; exp: number; jti?: string };

async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const publicKey = process.env.JWT_PUBLIC_KEY;
    if (!publicKey) throw new Error('JWT_PUBLIC_KEY not set');
    const [h, p, s] = token.split('.');
    const key = await crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const encoder = new TextEncoder();
    const data = encoder.encode(`${h}.${p}`);
    const signature = base64UrlToUint8Array(s);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    if (!valid) return null;
    const payload: JwtPayload = JSON.parse(base64UrlDecode(p));
    const skew = 5;
    if (payload.exp < Math.floor(Date.now() / 1000) - skew) return null;
    return payload;
  } catch (err) {
    console.error('JWT verification failed', err);
    return null;
  }
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlDecode(str: string) {
  const pad = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return atob(base64);
}

function base64UrlToUint8Array(str: string) {
  const decoded = base64UrlDecode(str);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('access_token')?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) {
    if (path !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // Optional membership check
  if (path !== '/pending-approval') {
    const siteId = process.env.NEXT_SITE_ID;
    const memberRes = await fetch(`${request.nextUrl.origin}/api/user/member-info?siteId=${siteId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': request.headers.get('cookie') || ''
      }
    });
    if (!memberRes.ok) {
      return NextResponse.redirect(new URL('/pending-approval', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales).*)',
  ],
};
