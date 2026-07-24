# Monitoring & Medic-fix runbook

## What exists (FamCircle side, this repo)

- **`/api/health`** (`src/app/api/health/route.ts`) — checks Firebase, Gmail,
  and Translation service health in parallel. Returns `200` when the critical
  services (Firebase + Gmail) are healthy, `503` when either is down, `500` on
  an unexpected crash. Response shape: `{ firebase, gmail, translation, overall: { healthy, allHealthy } }`.

- **`scripts/uptime-check.ts`** — hits the LIVE deployment's `/api/health` over
  real HTTP (DNS + SSL + routing + the app itself, not just a DB ping) and
  exits `0` (healthy) or `1` (unhealthy OR unreachable), printing one JSON line
  per run for log capture:
  ```
  npm run monitor:uptime -- --url https://aglamaz.com
  # or: TARGET_URL=https://aglamaz.com npx tsx scripts/uptime-check.ts
  ```
  No fallback URL is baked in — it fails loudly if no target is given, since
  this deployment is multi-tenant (`docs/MULTI_TENANT_SETUP.md`): `aglamaz.com`
  is the primary custom domain, but `/api/health` doesn't depend on domain
  mapping, so any live domain that resolves to this deployment is equivalent.

- **`tests/uptimeCheck.test.ts`** — proves the detection logic end-to-end
  against a real local HTTP server, across 4 simulated failure scenarios:
  healthy, simulated service outage (503 + `overall.healthy: false`),
  unreachable deployment (connection refused), and malformed response body.
  Part of `npm test`; run alone with `npx tsx tests/uptimeCheck.test.ts`.

This is the observability half: a real check against the real URL, and proof
(not just documentation) that failures are actually detected.

## What this wires into (fleet side — NOT part of this repo)

The fleet's **Medic** pattern (`~/develop/Buddy/docs/harness-model.md` §3.3) is
a *permission tier*, not FamCircle code: a lane holding the Medic permit may
push a FIX when prod is broken (scope = failure-fixes only, never features),
following the same 4-step chain as Shofar — deploy → verify on Vercel (READY
for the expected {branch, sha} + smoke curl) → check system vitals → report
to Agla naming the permit used.

Turning `scripts/uptime-check.ts` into a live "observe detects → Medic fixes"
loop needs, on the **buddy_infra** side:

1. A scheduled runner (systemd timer/cron, matching the fleet's existing
   `db_dr_*` + healthchecks.io dead-man's-switch convention) that calls
   `npm run monitor:uptime` against the real prod URL on a cadence, and pings
   an HC check on success so a *silently stopped* monitor pages too.
2. Routing a failing check to whichever lane/session owns FamCircle.
3. Granting that lane the Medic permit, if it doesn't already hold it.

Step 3 is a **permission-GRANT** under harness-model.md §4 ("THE ONE HARD
BOUNDARY"): it requires **Agla's literal word, in-context** — a Buddy relay
cannot clear it. That is precisely why this half can't be built from inside
the FamCircle repo/worktree: it isn't a FamCircle code change, it's a
fleet-harness permission change owned by Buddy/Ant and gated on Agla directly.

## Task split (per famcircle#98's own framing)

- **FamCircle side (done here):** `/api/health` (pre-existing) +
  `scripts/uptime-check.ts` + `tests/uptimeCheck.test.ts` + this runbook.
- **buddy_infra side (separate task, different repo):** scheduled runner,
  healthchecks.io wiring, and the Medic permission-grant for the FamCircle-owning
  lane — needs Agla's authorization and should be filed as its own
  `buddy_infra` task rather than attempted here.
