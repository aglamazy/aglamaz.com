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

- **`scripts/check-email-volume.ts`** (famcircle#144) — a dead-man's-switch on
  the email channel itself, not just app health: `/api/health` only proves
  Firebase/Gmail/Translation are reachable, it says nothing about whether
  crons/sends are actually firing. Built after a real 3-day (2026-07-25 to
  07-27) total Resend outage - digests, blog-autogen, reminders, everything -
  went undetected for 10 days, discovered by accident while investigating an
  unrelated question. Queries Resend's own send history directly (ground
  truth upstream of `emailTrackingEvents`, which only logs opens/clicks, never
  sends) for at least one email in a trailing window (default 96h, revised
  from an initial 48h after it false-positived on its first live run 2026-08-05
  - a genuinely healthy ~66h quiet stretch near a weekly-digest boundary, since
  the per-site weekly cadence isn't a single global day):
  ```
  npm run monitor:email-volume
  # or: RESEND_VOLUME_WINDOW_HOURS=72 npx tsx scripts/check-email-volume.ts
  ```
  Reads `RESEND_API_KEY` from the environment, no fallback. See
  `scripts/lib/emailVolumeCheck.ts` for the full floor/window reasoning,
  including the 2026-08-05 recalibration - still empirical, not proven
  optimal; recalibrate against fresh Resend history if it proves noisy or
  misses something, don't just guess a new number.

- **`tests/emailVolumeCheck.test.ts`** — same pattern as `uptimeCheck.test.ts`,
  proves the detection logic against a real local HTTP server (healthy, stale
  data outside the window, API error) without a live Resend call.

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
   `npm run monitor:uptime` AND `npm run monitor:email-volume` against the
   real prod URL/API on a cadence, and pings an HC check on success so a
   *silently stopped* monitor pages too. The email-volume check especially
   needs this - it is useless run manually after the fact, which is exactly
   how famcircle#144's 3-day outage was found: 10 days late, by accident.
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
