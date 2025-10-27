import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnvFile } from 'dotenv';

type Scenario = 'local' | 'preview' | 'production';
type EnvKey = 'TARGET_URL' | 'DEV_TEST_USER' | 'DEV_TEST_PASSWORD' | 'VERCEL_DEPLOYMENT_PROTECTION_BYPASS' | 'FIREBASE_API_KEY';

interface CliArgs {
  baseUrl?: string;
  scenario?: Scenario;
  authenticated?: boolean;
  verbose?: boolean;
}

interface ScenarioConfig {
  scenario: Scenario;
  targetUrl: string;
  headers: Record<string, string>;
}

interface LinkCheckResult {
  url: string;
  status: number;
  error?: string;
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

    if (current === '--authenticated' || current === '--auth') {
      result.authenticated = true;
      continue;
    }

    if (current === '--verbose' || current === '-v') {
      result.verbose = true;
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
    'User-Agent': 'aglamaz-link-checker/1.0',
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

  if (!res.ok) {
    throw new Error(`Session creation failed: ${res.status} ${res.statusText}`);
  }

  const cookies = res.headers.getSetCookie?.() || [];
  if (!cookies.length) {
    throw new Error('No session cookies returned by /api/auth/login');
  }

  return cookies.map((entry) => entry.split(';')[0]).join('; ');
}

function shouldSkipUrl(url: string): boolean {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  // Skip static assets
  if (
    pathname.startsWith('/_next/') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.map') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.webp')
  ) {
    return true;
  }

  // Skip malformed URLs with encoded quotes
  if (pathname.includes('%22') || pathname.includes('%27')) {
    return true;
  }

  return false;
}

function extractLinksFromHtml(html: string, baseUrl: URL, verbose: boolean = false): string[] {
  const links: string[] = [];

  // Only use the most reliable pattern
  const linkRegex = /<a[^>]+href=["']([^"']+)["']/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];

    // Skip external links, anchors, mailto, tel, etc.
    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        const hrefUrl = new URL(href);
        // Only include if same origin
        if (hrefUrl.origin === baseUrl.origin && !shouldSkipUrl(href)) {
          links.push(href);
        }
      } catch (error) {
        // Skip invalid URLs
      }
      continue;
    }

    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }

    // Convert relative URLs to absolute
    try {
      const absoluteUrl = new URL(href, baseUrl).toString();
      if (!shouldSkipUrl(absoluteUrl)) {
        links.push(absoluteUrl);
      }
    } catch (error) {
      // Skip invalid URLs
      if (verbose) {
        console.warn(`Skipping invalid URL: ${href}`);
      }
    }
  }

  const uniqueLinks = Array.from(new Set(links)); // Remove duplicates

  return uniqueLinks;
}

async function checkUrl(url: string, headers: Record<string, string>, cookieHeader?: string): Promise<LinkCheckResult> {
  try {
    const fetchHeaders = cookieHeader ? { ...headers, Cookie: cookieHeader } : headers;

    // Follow redirects to get the final status
    const res = await fetchWithHeaders(url, fetchHeaders, {
      method: 'GET',
      redirect: 'follow'
    });

    return { url, status: res.status };
  } catch (error) {
    return { url, status: 0, error: (error as Error).message };
  }
}

async function crawlAndCheckLinks(
  base: URL,
  startUrls: string[],
  headers: Record<string, string>,
  cookieHeader?: string,
  maxPages: number = 100,
  verbose: boolean = false
): Promise<LinkCheckResult[]> {
  const visited = new Set<string>();
  const toVisit = [...startUrls];
  const results: LinkCheckResult[] = [];
  const allLinks = new Set<string>();

  console.log(`Starting link crawl from ${startUrls.length} entry point(s)...`);
  if (verbose) {
    console.log(`Entry points: ${startUrls.join(', ')}`);
  }

  // First pass: crawl to discover all links
  while (toVisit.length > 0 && visited.size < maxPages) {
    const url = toVisit.shift()!;

    if (visited.has(url)) continue;
    visited.add(url);

    console.log(`[${visited.size}/${maxPages}] ${url}`);

    const result = await checkUrl(url, headers, cookieHeader);
    results.push(result);

    // Extract links from successful pages
    if (result.status >= 200 && result.status < 300) {
      try {
        // Fetch the page to extract links (checkUrl already followed redirects)
        const fetchHeaders = cookieHeader ? { ...headers, Cookie: cookieHeader } : headers;
        const res = await fetchWithHeaders(url, fetchHeaders, { method: 'GET', redirect: 'follow' });

        const finalUrl = res.url; // The URL after redirects
        const html = await res.text();
        const links = extractLinksFromHtml(html, new URL(finalUrl), verbose);

        if (verbose) {
          console.log(`  → Found ${links.length} links on this page`);

          if (links.length > 0) {
            console.log(`  → Links: ${links.slice(0, 5).join(', ')}${links.length > 5 ? ` ... and ${links.length - 5} more` : ''}`);
          }
        }

        for (const link of links) {
          allLinks.add(link);
          if (!visited.has(link)) {
            toVisit.push(link);
          }
        }
      } catch (error) {
        if (verbose) {
          console.warn(`  ✗ Failed to extract links from ${url}: ${(error as Error).message}`);
        }
      }
    } else if (verbose) {
      console.log(`  ✗ Skipping link extraction (status ${result.status})`);
    }
  }

  // Second pass: check any remaining discovered links that weren't visited during crawl
  const unvisitedLinks = Array.from(allLinks).filter(link => !visited.has(link));
  if (unvisitedLinks.length > 0) {
    console.log(`\nChecking ${unvisitedLinks.length} additional discovered links...`);
    for (const url of unvisitedLinks) {
      console.log(`  ${url}`);
      const result = await checkUrl(url, headers, cookieHeader);
      results.push(result);
    }
  }

  console.log(`\nCrawl complete. Visited ${visited.size} pages, found ${allLinks.size} total unique links.`);

  return results;
}

function analyzeResults(results: LinkCheckResult[]): void {
  const errors = results.filter(r => r.status === 404);
  const serverErrors = results.filter(r => r.status >= 500);
  const clientErrors = results.filter(r => r.status >= 400 && r.status < 500 && r.status !== 404);
  const success = results.filter(r => r.status >= 200 && r.status < 300);
  const fetchErrors = results.filter(r => r.status === 0);

  console.log('\n' + '='.repeat(80));
  console.log('LINK CHECK SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total URLs checked: ${results.length}`);
  console.log(`✅ Success (2xx): ${success.length}`);
  console.log(`⚠️  Client errors (4xx): ${clientErrors.length}`);
  console.log(`❌ Not found (404): ${errors.length}`);
  console.log(`🔥 Server errors (5xx): ${serverErrors.length}`);
  console.log(`💥 Fetch errors: ${fetchErrors.length}`);

  if (errors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('404 NOT FOUND ERRORS:');
    console.log('='.repeat(80));
    errors.forEach(result => {
      console.log(`❌ ${result.url}`);
    });
  }

  if (serverErrors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('SERVER ERRORS (5xx):');
    console.log('='.repeat(80));
    serverErrors.forEach(result => {
      console.log(`🔥 [${result.status}] ${result.url}`);
    });
  }

  if (fetchErrors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('FETCH ERRORS:');
    console.log('='.repeat(80));
    fetchErrors.forEach(result => {
      console.log(`💥 ${result.url}: ${result.error}`);
    });
  }

  if (clientErrors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('OTHER CLIENT ERRORS (4xx):');
    console.log('='.repeat(80));
    clientErrors.forEach(result => {
      console.log(`⚠️  [${result.status}] ${result.url}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Fail the test if there are 404s or server errors
  const hasCriticalErrors = errors.length > 0 || serverErrors.length > 0 || fetchErrors.length > 0;
  if (hasCriticalErrors) {
    throw new Error(`Link check failed: ${errors.length} 404 errors, ${serverErrors.length} server errors, ${fetchErrors.length} fetch errors`);
  }

  console.log('✅ All links are valid!');
}

async function run() {
  const args = parseArgs();
  const scenarioConfig = resolveScenario(process.env, args);

  const normalizedTarget = ensureTrailingSlash(scenarioConfig.targetUrl);
  const base = new URL(normalizedTarget);

  console.log(`Running link checker in ${scenarioConfig.scenario} mode against ${normalizedTarget}`);
  console.log(`Authenticated mode: ${args.authenticated ? 'yes' : 'no'}`);
  if (args.verbose) {
    console.log(`Verbose mode: enabled`);
  }

  let cookieHeader: string | undefined;
  const startUrls: string[] = [base.toString()];

  if (args.authenticated) {
    const login = resolveLoginCredentials(process.env);
    if (!login) {
      throw new Error('Authenticated mode requires DEV_TEST_USER / DEV_TEST_PASSWORD to be set.');
    }

    const apiKey = resolveFirebaseApiKey(process.env);
    if (!apiKey) {
      throw new Error('Missing FIREBASE_API_KEY for email/password sign-in');
    }

    console.log(`Logging in as ${login.email}...`);
    const idToken = await signInToFirebase(apiKey, login.email, login.password);
    cookieHeader = await createSession(base, scenarioConfig.headers, idToken);

    // For authenticated crawling, also start from /app
    startUrls.push(new URL('/app', base).toString());
  }

  const results = await crawlAndCheckLinks(base, startUrls, scenarioConfig.headers, cookieHeader, 100, args.verbose || false);
  analyzeResults(results);
}

run().catch((error) => {
  console.error('❌ Link check failed:', error);
  process.exitCode = 1;
});
