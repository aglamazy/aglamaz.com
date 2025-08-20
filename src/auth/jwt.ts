import { createSign, createVerify } from 'crypto';
import { TokenClaims, nowSeconds, inSeconds } from './tokens';

/** Normalize PEM strings by converting escaped newlines to real newlines. */
export function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, '\n');
}

/** URL-safe base64 encode. */
export function b64urlEncode(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** URL-safe base64 decode. */
export function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4;
  const base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(base64, 'base64');
}

interface SignOptions {
  expiresInSec: number;
  issuer?: string;
  subject?: string;
  audience?: string | string[];
  notBeforeSec?: number;
  kid?: string;
  jti?: string;
}

/** Sign a JWT using RS256. */
export function signJwt(claims: TokenClaims, opts: SignOptions): string {
  const privateKeyPem = process.env.JWT_PRIVATE_KEY;
  if (!privateKeyPem) throw new Error('JWT_PRIVATE_KEY not set');
  const key = normalizePem(privateKeyPem);

  const now = nowSeconds();
  const payload: TokenClaims = {
    ...claims,
    iss: opts.issuer ?? claims.iss,
    sub: opts.subject ?? claims.sub,
    aud: opts.audience ?? claims.aud,
    iat: now,
    exp: inSeconds(opts.expiresInSec),
    nbf: opts.notBeforeSec ? inSeconds(opts.notBeforeSec) : claims.nbf,
    jti: opts.jti ?? claims.jti,
  };

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: opts.kid || process.env.JWT_KID || undefined,
  } as Record<string, string>;

  const headerEncoded = b64urlEncode(JSON.stringify(header));
  const payloadEncoded = b64urlEncode(JSON.stringify(payload));
  const unsigned = `${headerEncoded}.${payloadEncoded}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(key);
  const sigEncoded = b64urlEncode(signature);

  return `${unsigned}.${sigEncoded}`;
}

interface VerifyOptions {
  clockSkewSec?: number;
  checkAud?: string | string[];
  checkIss?: string;
}

/** Verify a JWT and return its payload. */
export function verifyJwt(token: string, opts: VerifyOptions = {}): TokenClaims | null {
  try {
    const publicKeyPem = process.env.JWT_PUBLIC_KEY;
    if (!publicKeyPem) throw new Error('JWT_PUBLIC_KEY not set');
    const key = normalizePem(publicKeyPem);
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    const signature = b64urlDecode(s);
    if (!verifier.verify(key, signature)) return null;

    const payload: TokenClaims = JSON.parse(b64urlDecode(p).toString());

    const now = nowSeconds();
    const skew = opts.clockSkewSec ?? 5;
    if (payload.exp && payload.exp < now - skew) return null;
    if (payload.nbf && payload.nbf > now + skew) return null;

    if (opts.checkIss && payload.iss !== opts.checkIss) return null;
    if (opts.checkAud) {
      const aud = payload.aud;
      const checkAud = opts.checkAud;
      if (Array.isArray(aud)) {
        const arr = Array.isArray(checkAud) ? checkAud : [checkAud];
        if (!arr.some(a => aud.includes(a))) return null;
      } else if (aud !== checkAud && !(Array.isArray(checkAud) && checkAud.includes(aud || ''))) {
        return null;
      }
    }
    return payload;
  } catch (err) {
    console.error('JWT verification failed', err);
    return null;
  }
}
