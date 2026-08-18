#!/usr/bin/env tsx
/**
 * npm run test:deploy — the AI-12 weekly health suite (famcircle#161).
 *
 * Per ~/develop/Buddy/docs/spec-periodic-tests.md: "does-it-actually-work" checks
 * against the LIVE deployment, not "did it build". Built directly off the 2026-08-11
 * CRON_SECRET incident (famcircle#156) - 4 days silent because nothing verified a
 * rotated secret was actually live.
 *
 * Test list (spec's numbering):
 *   1. CRON_SECRET live      - each of the 5 cron routes, current secret -> 200 not 401
 *   1b. Cron registration    - Vercel's OWN scheduler state (not a manual probe) has
 *                              every entry from vercel.json actually registered - added
 *                              2026-08-18 per the control-proof-principle ("a control
 *                              must prove the STATE, not the ACTION"): item 1 alone
 *                              would keep reporting healthy forever if a cron entry got
 *                              silently dropped, since a manual call is indistinguishable
 *                              from the real scheduled trigger existing at all.
 *   1c. Referenced scripts   - every scripts/*.ts path this repo's own docs/ mention
 *                              actually exists in the checkout being tested - the class
 *                              behind BOTH check-digest-delivery.ts and
 *                              check-email-volume.ts having lived only on dev for
 *                              days/weeks (2026-08-18).
 *   2. Connections up        - /api/health (Firebase, Gmail, Translation)
 *   3. Disk space             - N/A, this deployment is Vercel serverless (no persistent
 *                               disk this app manages) - documented skip, not silently omitted
 *   4. Deployed-code freshness - live production commit SHA == local git HEAD
 *   5. Env completeness       - every var in EXPECTED_PROD_ENV_VARS is set in prod
 *   6. No-naked-500           - /api/health and /api/cron/digest (dryRun) return their
 *                               real status, not an uncaught crash
 *
 * Needs Vercel CLI auth (`vercel login` already done - reads the same token file the
 * CLI itself uses) for items 1, 4, 5 - this runs from ub02 (option C in the spec: "a
 * central cron on ub02 runs each project's script locally against the live URLs"), not
 * from inside the deployment's own runtime.
 *
 * Usage:
 *   npm run test:deploy -- --url https://aglamaz.com
 *   # or: TARGET_URL=https://aglamaz.com npm run test:deploy
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkHealth } from './lib/uptimeCheck';
import { checkAllCronAuth } from './lib/cronAuthCheck';
import { checkDeployFreshness } from './lib/deployFreshnessCheck';
import { checkEnvCompleteness, EXPECTED_PROD_ENV_VARS } from './lib/envCompletenessCheck';
import { checkCronRegistration, type ExpectedCronEntry, type RegisteredCronEntry } from './lib/cronRegistrationCheck';
import { checkReferencedScriptsExist, type ReferencedScriptGap } from './lib/referencedScriptsCheck';

const PROJECT_ID = 'prj_CJlIZEFuh7xrLyJxhtSZV5E8VoLZ';
const TEAM_ID = 'team_llVcU3OqbxiFo7DtRU1lunMK';

function parseUrlArg(): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url' && i + 1 < argv.length) return argv[i + 1];
    if (argv[i].startsWith('--url=')) return argv[i].split('=').slice(1).join('=');
  }
  return undefined;
}

function vercelToken(): string {
  const authPath = join(process.env.HOME || '', '.local/share/com.vercel.cli/auth.json');
  const raw = JSON.parse(readFileSync(authPath, 'utf8'));
  if (!raw.token) throw new Error(`No token in ${authPath} - run \`vercel login\` first.`);
  return raw.token;
}

async function vercelApi(path: string): Promise<any> {
  const res = await fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM_ID}`, {
    headers: { Authorization: `Bearer ${vercelToken()}` },
  });
  if (!res.ok) throw new Error(`Vercel API ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchLiveProductionSha(): Promise<string | null> {
  const body = await vercelApi(`/v6/deployments?projectId=${PROJECT_ID}&target=production&limit=1`);
  return body.deployments?.[0]?.meta?.githubCommitSha ?? null;
}

async function listSetProductionEnvKeys(): Promise<Set<string>> {
  const body = await vercelApi(`/v9/projects/${PROJECT_ID}/env`);
  const keys = (body.envs || [])
    .filter((e: any) => (e.target || []).includes('production'))
    .map((e: any) => e.key as string);
  return new Set(keys);
}

/** Vercel's OWN cron registration state, not a manual probe - see cronRegistrationCheck.ts's header. */
async function fetchRegisteredCrons(): Promise<RegisteredCronEntry[]> {
  const body = await vercelApi(`/v9/projects/${PROJECT_ID}`);
  const definitions = body.crons?.definitions ?? [];
  return definitions.map((d: any) => ({ path: d.path as string, schedule: d.schedule as string }));
}

/**
 * vercel.json IS the intended cron list - reading it here instead of a second hardcoded
 * copy avoids the two ever drifting apart. `path` (including any query string, e.g.
 * "/api/cron/digest?cadence=weekly") is kept verbatim - Vercel's own registration API
 * returns it in exactly this shape, not split into path+query.
 */
function expectedCronsFromVercelJson(): ExpectedCronEntry[] {
  const raw = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf8'));
  return (raw.crons || []).map((c: any) => ({ path: c.path as string, schedule: c.schedule as string }));
}

/** Pulls the CURRENT production CRON_SECRET via the Vercel CLI - never printed, read once into memory, temp file deleted immediately. */
function currentCronSecret(): string {
  const tmpPath = join(tmpdir(), `test-deploy-env-${process.pid}.txt`);
  try {
    execFileSync('vercel', ['env', 'pull', tmpPath, '--environment=production', '--yes'], { stdio: 'pipe' });
    const content = readFileSync(tmpPath, 'utf8');
    const match = content.match(/^CRON_SECRET=(.*)$/m);
    if (!match) throw new Error('CRON_SECRET not present in pulled production env');
    return match[1].replace(/^"|"$/g, '');
  } finally {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  }
}

function localGitSha(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname + '/..' }).toString().trim();
}

const REPO_ROOT = join(__dirname, '..');

/** Every `scripts/*.ts` path this repo's own docs and vercel.json claim exists, paired with where. */
async function findReferencedScriptPaths(): Promise<ReferencedScriptGap[]> {
  const gaps: ReferencedScriptGap[] = [];
  const seen = new Set<string>();

  const docFiles = execFileSync('find', ['docs', '-name', '*.md'], { cwd: REPO_ROOT }).toString().trim().split('\n').filter(Boolean);
  for (const doc of docFiles) {
    const content = readFileSync(join(REPO_ROOT, doc), 'utf8');
    const matches = content.match(/scripts\/[\w-]+(\/[\w-]+)*\.ts/g) || [];
    for (const scriptPath of matches) {
      const key = `${scriptPath}::${doc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      gaps.push({ scriptPath, referencedIn: doc });
    }
  }
  return gaps;
}

interface CheckSummary {
  name: string;
  healthy: boolean;
  detail: string;
}

async function main() {
  const url = parseUrlArg() ?? process.env.TARGET_URL;
  if (!url) {
    console.error('test-deploy: no target URL. Pass --url <https://...> or set TARGET_URL.');
    process.exitCode = 1;
    return;
  }

  const summaries: CheckSummary[] = [];

  // 3. Disk space - N/A, documented not silently skipped.
  summaries.push({
    name: 'disk-space',
    healthy: true,
    detail: 'N/A - Vercel serverless, no persistent disk this app manages',
  });

  // 2 + 6 (health half). /api/health already covers Firebase/Gmail/Translation and
  // returns real 200/503/500 - one call serves both "connections up" and part of
  // "no-naked-500".
  const health = await checkHealth(url);
  summaries.push({
    name: 'connections-up (/api/health)',
    healthy: health.healthy,
    detail: health.reachable ? `HTTP ${health.statusCode}` : `unreachable: ${health.error}`,
  });

  // 1. CRON_SECRET live, per route.
  let secret: string;
  try {
    secret = currentCronSecret();
  } catch (err) {
    summaries.push({
      name: 'cron-secret-live (all 5 routes)',
      healthy: false,
      detail: `could not pull current CRON_SECRET: ${err instanceof Error ? err.message : String(err)}`,
    });
    secret = '';
  }
  if (secret) {
    const cronResults = await checkAllCronAuth(url, secret);
    const allHealthy = cronResults.every((r) => r.healthy);
    summaries.push({
      name: 'cron-secret-live (all 5 routes)',
      healthy: allHealthy,
      detail: cronResults.map((r) => `${r.route}=${r.statusCode ?? r.error}`).join(', '),
    });
  }

  // 1b. Cron registration - the STATE, not the ACTION (2026-08-18, control-proof-
  // principle). checkAllCronAuth above proves "the route accepts a manual call" - this
  // proves "Vercel is actually configured to make that call at all."
  const registration = await checkCronRegistration(expectedCronsFromVercelJson(), { fetchRegisteredCrons });
  summaries.push({
    name: 'cron-registration (Vercel scheduler state)',
    healthy: registration.healthy,
    detail: registration.healthy
      ? 'every expected cron entry is registered'
      : [
          registration.missing.length ? `missing: ${registration.missing.map((e) => `${e.path} (${e.schedule})`).join(', ')}` : '',
          registration.scheduleMismatches.length
            ? `schedule mismatch: ${registration.scheduleMismatches.map((m) => `${m.path} expected=${m.expected} registered=${m.registered}`).join(', ')}`
            : '',
        ].filter(Boolean).join('; '),
  });

  // 4. Deployed-code freshness.
  const freshness = await checkDeployFreshness(localGitSha(), { fetchLiveProductionSha });
  summaries.push({
    name: 'deployed-code-freshness',
    healthy: freshness.healthy,
    detail: freshness.error ?? `live=${freshness.liveSha?.slice(0, 7)} expected=${freshness.expectedSha?.slice(0, 7)}`,
  });

  // 1c. Referenced-but-absent scripts (2026-08-18, Buddy's "class question" off
  // check-digest-delivery.ts/check-email-volume.ts both having lived only on dev for
  // days) - a script this repo's own docs claim exists must actually be in this checkout.
  const referencedScripts = await checkReferencedScriptsExist({
    findReferencedScriptPaths,
    fileExists: (p) => existsSync(join(REPO_ROOT, p)),
  });
  summaries.push({
    name: 'referenced-scripts-present',
    healthy: referencedScripts.healthy,
    detail: referencedScripts.healthy
      ? 'every scripts/*.ts path mentioned in docs/ exists in this checkout'
      : `missing: ${referencedScripts.missing.map((m) => `${m.scriptPath} (per ${m.referencedIn})`).join(', ')}`,
  });

  // 5. Env completeness.
  const envResult = await checkEnvCompleteness(EXPECTED_PROD_ENV_VARS, { listSetProductionEnvKeys });
  summaries.push({
    name: 'env-completeness',
    healthy: envResult.healthy,
    detail: envResult.healthy ? 'all expected vars set' : `missing: ${envResult.missing.map((v) => v.name).join(', ')}`,
  });

  const allHealthy = summaries.every((s) => s.healthy);
  for (const s of summaries) {
    console.log(`${s.healthy ? '✅' : '❌'} ${s.name} — ${s.detail}`);
  }
  console.log(JSON.stringify({ healthy: allHealthy, checks: summaries }));

  if (!allHealthy) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('test-deploy: fatal error:', err);
  process.exitCode = 1;
});
