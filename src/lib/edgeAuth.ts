// utils/auth/verifyAccessToken.ts
import { jwtVerify, importSPKI } from 'jose'

const ALG = 'RS256'

// Build-time env is fine in Edge. Keep PEM with literal \n in .env
const PUBLIC_KEY_PEM = process.env.JWT_PUBLIC_KEY
if (!PUBLIC_KEY_PEM) throw new Error('JWT_PUBLIC_KEY not set')

// Cache the parsed CryptoKey across invocations on the same isolate
let cachedKey: CryptoKey | undefined

async function getVerifyKey() {
  if (!cachedKey) {
    const spki = PUBLIC_KEY_PEM.replace(/\\n/g, '\n').trim()
    cachedKey = await importSPKI(spki, ALG)
  }
  return cachedKey
}

export async function verifyJwt<T extends object = Record<string, unknown>>(token: string): Promise<T> {
  try {
    const key = await getVerifyKey()
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALG],
      // Optional: allow small clock skew if needed
      // clockTolerance: '5s',
    })
    return payload as T
  } catch (error) {
    throw error;
  }
}

export function verifyAccessToken<T extends object = Record<string, unknown>>(token: string) {
  return verifyJwt<T>(token)
}
