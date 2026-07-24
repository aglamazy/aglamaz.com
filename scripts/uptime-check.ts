#!/usr/bin/env tsx

/**
 * Uptime/error observability check for the live deployment.
 *
 * Hits `${url}/api/health` over real HTTP (DNS + SSL + routing + app, not
 * just a DB ping) and exits 0/1 so it composes with the fleet's existing
 * dead-man's-switch monitoring convention (healthchecks.io ping on success).
 *
 * Usage:
 *   npx tsx scripts/uptime-check.ts --url https://aglamaz.com
 *   TARGET_URL=https://aglamaz.com npx tsx scripts/uptime-check.ts
 *
 * See docs/monitoring-runbook.md for how this wires into the fleet's
 * observe -> Medic auto-fix pattern.
 */

import { checkHealth } from './lib/uptimeCheck';

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

  if (!url) {
    console.error(
      'uptime-check: no target URL provided. Pass --url <https://...> or set TARGET_URL.\n' +
      'This deployment is multi-tenant (docs/MULTI_TENANT_SETUP.md) — the primary custom ' +
      'domain is https://aglamaz.com; /api/health does not depend on domain mapping.'
    );
    process.exitCode = 1;
    return;
  }

  const result = await checkHealth(url);
  console.log(JSON.stringify(result));

  if (!result.healthy) {
    process.exitCode = 1;
  }
}

main();
