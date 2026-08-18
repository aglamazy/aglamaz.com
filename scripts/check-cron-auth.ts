#!/usr/bin/env tsx
/**
 * Cron-auth dead-man's-switch (famcircle#160).
 *
 * Detects the exact failure class that broke all 5 aglamaz.com cron routes for 4 days
 * (famcircle#156, 2026-08-11): CRON_SECRET rotated in Vercel's dashboard, but the
 * already-running deployment kept the pre-rotation value and every cron call 401'd
 * silently. See docs/monitoring-runbook.md and
 * ~/.claude/projects/-home-yaakov-develop-Aglamaz-FamCircle/memory/feedback_env_rotation_needs_redeploy.md.
 *
 * Exits 0 (healthy) or 1 (unhealthy OR unreachable), one JSON line per run - same
 * contract as scripts/uptime-check.ts, so it composes with the same fleet dead-man's-
 * switch convention (healthchecks.io ping on success).
 *
 * Usage:
 *   CRON_SECRET=<current prod value, from Tzach> npx tsx scripts/check-cron-auth.ts --url https://aglamaz.com
 *
 * The secret passed here MUST be the CURRENT value, obtained through Tzach/Custodian's
 * sanctioned credential-read path - NEVER `vercel env pull` (a known SSOT-corrupter as
 * of 2026-08-18: it overwrites plaintext local env files with `{v: v2}`-wrapped values;
 * sync is SSOT-to-Vercel only, never back). Not .env.local's own copy either - the
 * whole point of this check is comparing the deployed function against the live
 * dashboard value, not whatever a dev machine happens to have cached.
 */
import { checkCronAuth } from './lib/cronAuthCheck';

function parseUrlArg(): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--url' && i + 1 < argv.length) return argv[i + 1];
    if (argv[i].startsWith('--url=')) return argv[i].split('=').slice(1).join('=');
  }
  return undefined;
}

async function main() {
  const url = parseUrlArg() ?? process.env.TARGET_URL;
  const secret = process.env.CRON_SECRET;

  if (!url) {
    console.error(
      'check-cron-auth: no target URL provided. Pass --url <https://...> or set TARGET_URL.'
    );
    process.exitCode = 1;
    return;
  }
  if (!secret) {
    console.error(
      'check-cron-auth: no CRON_SECRET provided. Pass the CURRENT production value, ' +
      'obtained via Tzach/Custodian\'s sanctioned credential-read path (never `vercel env ' +
      'pull` - SSOT-corrupter, forbidden) - not a stale local .env.local copy.'
    );
    process.exitCode = 1;
    return;
  }

  const result = await checkCronAuth(url, secret);
  console.log(JSON.stringify(result));

  if (!result.healthy) {
    process.exitCode = 1;
  }
}

main();
