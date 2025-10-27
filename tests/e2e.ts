import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnvFile } from 'dotenv';

type Scenario = 'local' | 'preview' | 'production';
type EnvKey = 'TARGET_URL' // Site address
  | 'DEV_TEST_USER' // User to login with
  | 'DEV_TEST_PASSWORD' // User's password
  | 'VERCEL_DEPLOYMENT_PROTECTION_BYPASS' // token to access preview env
  | 'FIREBASE_API_KEY' // API key for login using firebase

interface CliArgs {
  baseUrl?: string;
  scenario?: Scenario;
}

interface ScenarioConfig {
  scenario: Scenario;
  targetUrl: string;
  headers: Record<string, string>;
}

function parseScenarioToken(token: string | undefined): Scenario | undefined {
  switch (token) {
    case 'local':
      return 'local';
    case 'preview':
      return 'preview';
    case 'production':
    case 'prod':
      return 'production';
    default:
      return undefined;
  }
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === '--base-url' && i + 1 < argv.length) {
      result.baseUrl = argv[i + 1];
      i += 1;
      continue;
    }

    if (current.startsWith('--base-url=')) {
      result.baseUrl = current.split('=')[1];
      continue;
    }

    if (current === '--scenario' && i + 1 < argv.length) {
      result.scenario = parseScenarioToken(argv[i + 1]);
      i += 1;
      continue;
    }

    if (current.startsWith('--scenario=')) {
      result.scenario = parseScenarioToken(current.split('=')[1]);
      continue;
    }

    const shorthandScenario = parseScenarioToken(current.replace(/^--/, ''));
    if (shorthandScenario) {
      result.scenario = shorthandScenario;
    }
  }

  return result;
}

function readEnvValue(env: NodeJS.ProcessEnv, key: EnvKey): string | undefined {
    const value = env[key];
    if (value && value.trim()) {
      return value.trim();
    }
  return undefined;
}

function determineScenario(env: NodeJS.ProcessEnv, override?: Scenario): Scenario {
  if (override) return override;

  const vercelEnv = env.VERCEL_ENV?.toLowerCase();
  if (vercelEnv === 'preview') return 'preview';
  if (vercelEnv === 'production') return 'production';

  if (env.NODE_ENV?.toLowerCase() === 'production') return 'production';
  if (env.TARGET_URL) return 'preview';

  return 'local';
}

function loadLocalEnvIfPresent() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    loadEnvFile({ path: envPath, override: false });
  }
}

function resolveTargetUrl(env: NodeJS.ProcessEnv, args: CliArgs, scenario: Scenario): string {
  const argTarget = args.baseUrl?.trim();
  if (argTarget) {
    return argTarget;
  }

  const envTarget = readEnvValue(env, 'TARGET_URL');
  if (envTarget) {
    return envTarget;
  }

  if (scenario === 'local') {
    return 'http://localhost:3000';
  }

  throw new Error('Missing TARGET_URL (or --base-url) for preview/production runs.');
}

function buildHeaders(env: NodeJS.ProcessEnv, scenario: Scenario): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    'User-Agent': 'aglamaz-e2e-test/1.0',
  };

  const username = readEnvValue(env, 'DEV_TEST_USER');
  const password = readEnvValue(env, 'DEV_TEST_PASSWORD');
  const bypassToken = readEnvValue(env, 'VERCEL_DEPLOYMENT_PROTECTION_BYPASS');

  if ((username && !password) || (!username && password)) {
    throw new Error('Both dev username and password must be provided when using auth test.');
  }

  if (scenario === 'preview' && !((username && password) || bypassToken)) {
    throw new Error(
      'Preview deployments require VERCEL_PROTECTION_USER/VERCEL_PROTECTION_PASSWORD or a VERCEL_DEPLOYMENT_PROTECTION_BYPASS token.'
    );
  }

  if (username && password) {
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    baseHeaders.Authorization = `Basic ${encoded}`;
  }

  if (bypassToken) {
    baseHeaders['x-vercel-protection-bypass'] = bypassToken;
  }

  return baseHeaders;
}

function resolveScenario(env: NodeJS.ProcessEnv, args: CliArgs): ScenarioConfig {
  const scenario = determineScenario(env, args.scenario);

  if (scenario === 'local') {
    console.log('Detected local scenario; loading .env.local if present.');
    loadLocalEnvIfPresent();
  }

  const targetUrl = resolveTargetUrl(process.env, args, scenario);

  try {
    // Validate early so we fail fast with a clear message.
    new URL(targetUrl);
  } catch (error) {
    throw new Error(`Invalid target URL provided: ${(error as Error).message}`);
  }

  const headers = buildHeaders(process.env, scenario);

  return { scenario, targetUrl, headers };
}

function ensureTrailingSlash(url: string) {
  if (!url.endsWith('/')) return `${url}/`;
  return url;
}

async function fetchWithHeaders(url: string, defaultHeaders: Record<string, string>, init?: RequestInit) {
  const initHeaders = (init?.headers ?? {}) as Record<string, string>;
  const mergedHeaders = { ...defaultHeaders, ...initHeaders };
  return fetch(url, { ...init, headers: mergedHeaders });
}

async function checkRoot(url: string, headers: Record<string, string>) {
  console.log(`Checking ${url}`);
  const res = await fetchWithHeaders(url, headers, { method: 'GET', redirect: 'follow' });
  assert.ok(res.ok, `Root response expected 200-range, received ${res.status} ${res.statusText}`);

  const html = await res.text();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const siteName = titleMatch ? titleMatch[1].trim() : 'Unknown';
  console.log(`✅ Root OK: ${res.status} ${res.statusText} – site title: ${siteName}`);
}

async function checkSitemap(base: URL, headers: Record<string, string>) {
  const sitemapUrl = new URL('/sitemap.xml', base).toString();
  console.log(`Fetching sitemap ${sitemapUrl}`);
  const res = await fetchWithHeaders(sitemapUrl, headers, { method: 'GET', redirect: 'manual' });
  assert.ok(res.ok, `sitemap.xml expected 200-range, received ${res.status} ${res.statusText}`);
  const xml = await res.text();
  const urlCount = (xml.match(/<url>/g) || []).length;
  console.log(`✅ sitemap.xml OK: ${res.status} ${res.statusText} – contains ${urlCount} url entries`);

  // Extract all <loc> values
  const locMatches = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  const missingJsonLd: string[] = [];

  for (const loc of locMatches) {
    try {
      const pageRes = await fetchWithHeaders(loc, headers, { method: 'GET', redirect: 'manual' });
      if (!pageRes.ok) {
        missingJsonLd.push(`${loc} (status ${pageRes.status})`);
        continue;
      }
      const body = await pageRes.text();
      if (!body.includes('type="application/ld+json"')) {
        missingJsonLd.push(loc);
      }
    } catch (error) {
      missingJsonLd.push(`${loc} (fetch error: ${(error as Error).message})`);
    }
  }

  if (missingJsonLd.length) {
    throw new Error(`Pages missing JSON-LD: ${missingJsonLd.join(', ')}`);
  }
  console.log('✅ All sitemap pages contain JSON-LD');
}

function resolveLoginCredentials(env: NodeJS.ProcessEnv) {
  const email = readEnvValue(env, 'DEV_TEST_USER');
  const password = readEnvValue(env, 'DEV_TEST_PASSWORD');

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

function resolveFirebaseApiKey(env: NodeJS.ProcessEnv) {
  return readEnvValue(env, 'FIREBASE_API_KEY');
}

async function signInToFirebase(apiKey: string, email: string, pass: string) {
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

async function createSession(base: URL, defaultHeaders: Record<string, string>, idToken: string) {
  const loginUrl = new URL('/api/auth/login', base).toString();
  const res = await fetchWithHeaders(loginUrl, defaultHeaders, {
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

async function verifyApp(base: URL, defaultHeaders: Record<string, string>, cookieHeader: string) {
  const appUrl = new URL('/app', base).toString();
  const res = await fetchWithHeaders(appUrl, defaultHeaders, {
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
  const args = parseArgs();
  const scenarioConfig = resolveScenario(process.env, args);

  const normalizedTarget = ensureTrailingSlash(scenarioConfig.targetUrl);
  const base = new URL(normalizedTarget);

  console.log(`Running e2e in ${scenarioConfig.scenario} mode against ${normalizedTarget}`);

  await checkRoot(base.toString(), scenarioConfig.headers);
  await checkSitemap(base, scenarioConfig.headers);

  const login = resolveLoginCredentials(process.env);
  if (!login) {
    console.warn('Skipping session login because DEV_TEST_EMAIL / DEV_TEST_PASSWORD are not set.');
    return;
  }

  const apiKey = resolveFirebaseApiKey(process.env);
  if (!apiKey) {
    throw new Error('Missing FIREBASE_API_KEY (or NEXT_PUBLIC_FIREBASE_API_KEY) for email/password sign-in');
  }

  console.log(`Logging in as ${login.email}`);
  const idToken = await signInToFirebase(apiKey, login.email, login.password);
  const cookieHeader = await createSession(base, scenarioConfig.headers, idToken);
  await verifyApp(base, scenarioConfig.headers, cookieHeader);

  // Run link checker
  console.log('\n' + '='.repeat(80));
  console.log('Running link checker...');
  console.log('='.repeat(80));
  const { execSync } = await import('child_process');
  try {
    const linkCheckCmd = `npm run test:links:auth -- --base-url=${normalizedTarget}`;
    execSync(linkCheckCmd, { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Link checker passed');
  } catch (error) {
    throw new Error('Link checker failed');
  }
}

run().catch((error) => {
  console.error('❌ E2E check failed:', error);
  process.exitCode = 1;
});
