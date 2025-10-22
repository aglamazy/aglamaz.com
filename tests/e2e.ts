import assert from 'node:assert/strict';

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (current === '--base-url' && i + 1 < args.length) {
      baseUrl = args[i + 1];
      i += 1;
      continue;
    }
    if (current.startsWith('--base-url=')) {
      baseUrl = current.split('=')[1];
      continue;
    }
  }

  return {
    baseUrl,
  };
}

const { baseUrl } = parseArgs();
const envTarget = process.env.TARGET_URL || process.env.DEV_TEST_URL || process.env.DEV_TARGET_URL;

if (!baseUrl && !envTarget) {
  console.error('Missing TARGET_URL (or --base-url). Set TARGET_URL in the environment or pass --base-url=...');
  process.exitCode = 1;
  process.exit();
}

const targetUrl = (baseUrl || envTarget).trim();
const username =
  process.env.VERCEL_PROTECTION_USER ||
  process.env.DEV_TEST_USER ||
  process.env.BASIC_AUTH_USER ||
  '';
const password =
  process.env.VERCEL_PROTECTION_PASSWORD ||
  process.env.DEV_TEST_PASSWORD ||
  process.env.BASIC_AUTH_PASSWORD ||
  '';
const bypassToken =
  process.env.VERCEL_DEPLOYMENT_PROTECTION_BYPASS ||
  process.env.VERCEL_PROTECTION_BYPASS ||
  process.env.DEV_TEST_BYPASS_TOKEN ||
  '';

if ((!username || !password) && !bypassToken) {
  console.error(
    'Missing credentials: set VERCEL_PROTECTION_USER/VERCEL_PROTECTION_PASSWORD (or DEV_TEST_* / BASIC_AUTH_*) or provide VERCEL_DEPLOYMENT_PROTECTION_BYPASS.'
  );
  process.exitCode = 1;
  process.exit();
}

const headers: Record<string, string> = {
  'User-Agent': 'aglamaz-e2e-test/1.0',
};

if (username && password) {
  const encoded = Buffer.from(`${username}:${password}`).toString('base64');
  headers.Authorization = `Basic ${encoded}`;
}

if (bypassToken) {
  headers['x-vercel-protection-bypass'] = bypassToken;
}

function ensureTrailingSlash(url: string) {
  if (!url.endsWith('/')) return `${url}/`;
  return url;
}

async function fetchWithHeaders(url: string, init?: RequestInit) {
  const mergedHeaders = { ...headers, ...(init?.headers as Record<string, string> | undefined) };
  return fetch(url, { ...init, headers: mergedHeaders });
}

async function checkRoot(url: string) {
  console.log(`Checking ${url}`);
  const res = await fetchWithHeaders(url, { method: 'GET', redirect: 'manual' });
  assert.ok(res.ok, `Root response expected 200-range, received ${res.status} ${res.statusText}`);

  const html = await res.text();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const siteName = titleMatch ? titleMatch[1].trim() : 'Unknown';
  console.log(`✅ Root OK: ${res.status} ${res.statusText} – site title: ${siteName}`);
}

async function signInToFirebase(email: string, pass: string) {
  const apiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.REACT_APP_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error('Missing FIREBASE_API_KEY (or NEXT_PUBLIC_FIREBASE_API_KEY) for email/password sign-in');
  }

  const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + apiKey, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: pass, returnSecureToken: true }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Firebase auth failed: ${res.status} ${res.statusText} ${(data && data.error && data.error.message) || ''}`);
  }

  if (!data.idToken) {
    throw new Error('Firebase auth missing idToken');
  }

  return data.idToken as string;
}

async function createSession(base: URL, idToken: string) {
  const loginUrl = new URL('/api/auth/login', base).toString();
  const res = await fetchWithHeaders(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idToken }),
    redirect: 'manual',
  });

  assert.ok(res.ok, `Session creation failed: ${res.status} ${res.statusText}`);

  const cookies = res.headers.getSetCookie?.() || [];
  if (!cookies.length) {
    throw new Error('No session cookies returned by /api/auth/login');
  }

  return cookies.map((entry) => entry.split(';')[0]).join('; ');
}

async function verifyApp(base: URL, cookieHeader: string) {
  const appUrl = new URL('/app', base).toString();
  const res = await fetchWithHeaders(appUrl, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
    },
    redirect: 'manual',
  });

  assert.ok(res.ok, `/app expected 200-range, received ${res.status} ${res.statusText}`);
  const html = await res.text();
  const headingMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const headingText = headingMatch ? headingMatch[1].trim() : 'Unknown';
  console.log(`✅ /app OK: ${res.status} ${res.statusText} – heading: ${headingText}`);
}

async function run() {
  const normalized = ensureTrailingSlash(targetUrl);
  const base = new URL(normalized);

  await checkRoot(base.toString());

  const loginEmail = process.env.DEV_TEST_EMAIL || process.env.TEST_EMAIL || '';
  const loginPassword = process.env.DEV_TEST_PASSWORD || process.env.TEST_PASSWORD || '';

  if (!loginEmail || !loginPassword) {
    console.warn('Skipping session login because DEV_TEST_EMAIL / DEV_TEST_PASSWORD are not set.');
    return;
  }

  console.log(`Logging in as ${loginEmail}`);
  const idToken = await signInToFirebase(loginEmail, loginPassword);
  const cookieHeader = await createSession(base, idToken);
  await verifyApp(base, cookieHeader);
}

run().catch((error) => {
  console.error('❌ E2E check failed:', error);
  process.exitCode = 1;
});
