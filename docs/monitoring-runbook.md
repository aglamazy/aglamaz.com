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
  sends) for at least one email in a trailing window (default **48h, kept
  deliberately tight** - a same-night attempt to widen it to 96h to stop a
  false positive was rejected by Buddy 2026-08-05: the founding outage was
  72h, so a 96h window is guaranteed to sleep through the exact incident this
  check exists to catch. Interim tradeoff: keep 48h, route its (expected,
  frequent) alarms to Buddy only rather than a production-down page - noise
  into an inbox is cheap, a blind spot is not; that routing is a timer/infra
  concern, not something this script does):
  ```
  npm run monitor:email-volume
  # or: RESEND_VOLUME_WINDOW_HOURS=72 npx tsx scripts/check-email-volume.ts
  ```
  Reads `RESEND_API_KEY` from the environment, no fallback. See
  `scripts/lib/emailVolumeCheck.ts` for the full reasoning. Still runs
  alongside `check-digest-delivery.ts` below, not replaced by it - see that
  entry for why both are needed.

- **`tests/emailVolumeCheck.test.ts`** — same pattern as `uptimeCheck.test.ts`,
  proves the detection logic against a real local HTTP server (healthy, stale
  data outside the window, API error) without a live Resend call.

- **`scripts/check-digest-delivery.ts`** (famcircle#144 follow-up, 2026-08-05) —
  schedule-aware replacement/supplement for `check-email-volume.ts`'s blunt
  staleness floor, built after Buddy rejected widening that window further:
  *"the fix is not to widen the window until it stops complaining - that just
  moves the blind spot. Size it to the actual send calendar: a weekly digest
  means the check should ask 'did the digest that was DUE actually go', not
  'has anything gone recently'."* Correcting an earlier claim in this repo's
  history: the weekly cadence is **not** per-site - `DigestScheduleService`'s
  `nextWeeklyFireDate` is a single global Friday-06:00-UTC burst window (see
  `src/services/DigestScheduleService.ts`), so "did Friday's digest go out"
  is a well-defined, checkable question.

  For each cadence (weekly/monthly) whose last scheduled fire has cleared a
  grace window (default 2h, covers the cron's own up-to-1h retry burst), and
  for every site with the `digest` send-type enabled
  (`SiteRepository.resolveSendSettings`), it calls the exact same
  `resolveDigestRecipients` function the real cron
  (`src/app/api/cron/digest/route.ts`) and the admin preview endpoint use - no
  parallel reimplementation of "who's eligible" to drift out of sync. A site
  with zero eligible members for that cadence/period is skipped (normal - the
  real cron does the same "nobody eligible" skip). A site WITH eligible
  members where every one of them is still unsent for an already-fired period
  is flagged as a genuine miss:
  ```
  npm run monitor:digest-delivery
  # or: DIGEST_DELIVERY_GRACE_HOURS=4 npx tsx scripts/check-digest-delivery.ts
  ```
  Reads Firebase Admin credentials the same way the app does (no separate
  API key). See `scripts/lib/digestDeliveryCheck.ts` for the pure
  dependency-injected check logic and `tests/digestDeliveryCheck.test.ts` for
  the 5 scenarios it proves (grace window not yet elapsed, all-unsent miss,
  partial-sent healthy, zero-eligible skip, per-site error isolation) without
  touching a live Firestore project.

  This does not replace `check-email-volume.ts` - run both, for two separate
  reasons Buddy flagged 2026-08-05: (1) the *other* send types (in-day
  reminders, yahrzeit WhatsApp, blog-autogen) have no fixed weekly/monthly
  schedule for this check to evaluate against, and (2) this check's
  per-period precision has a real blind spot of its own - if every
  digest-enabled site happens to have zero eligible recipients for a given
  due period, this check correctly reports healthy even if the entire email
  channel is silently dead (the exact 2026-07-25..07-27 founding outage would
  still pass a per-period check that only looks at digest math). The blunter
  `check-email-volume.ts` floor is what catches "nothing sent anywhere,
  regardless of why" - keep it running as the backstop, not just for its own
  send types.

- **`tests/digestDeliveryCheck.test.ts`** — proves `digestDeliveryCheck.ts`'s
  logic against fake injected dependencies (no live Firestore), same
  dependency-injection pattern as the HTTP-mock tests above.

- **`scripts/check-cron-auth.ts`** (famcircle#160, 2026-08-16) — the check
  that would have caught famcircle#156 same-day: on 2026-08-11, `CRON_SECRET`
  was rotated in Vercel's dashboard, but the already-deployed function kept
  the pre-rotation value and every one of the 5 cron routes silently 401'd for
  4 days. No app code can detect this from the inside - a deployed function
  has no way to know its own baked env value is stale relative to the
  dashboard. This can only be caught from OUTSIDE: get the CURRENT secret
  and make a real request with it, watching for a 401:
  ```
  CRON_SECRET=<current prod value, from Tzach - NEVER `vercel env pull`, a known
    SSOT-corrupter as of 2026-08-18> \
    npx tsx scripts/check-cron-auth.ts --url https://aglamaz.com
  ```
  Uses the `digest` route as the canary with `memberId=<nonexistent>` (a safe
  no-op - see the route's `memberIdFilter` handling) since all 5 cron routes
  share the identical `CRON_SECRET` check and the same deployment, so one
  route's auth result generalizes to all of them. See
  `scripts/lib/cronAuthCheck.ts` for the pure check logic and
  `tests/cronAuthCheck.test.ts` for the 5 scenarios it proves (matching
  secret, the exact famcircle#156 401-mismatch shape, unreachable deployment,
  a route-SPECIFIC failure isolated from its healthy siblings, all-5-healthy)
  against a real local HTTP server, no live Vercel/Firestore needed. Unlike
  the other checks here, this one needs the CURRENT secret handed to it
  explicitly each run - there's no way to bake a "correct" value in, since
  the whole point is comparing against whatever Vercel's dashboard says RIGHT
  NOW, which is exactly the thing a deployed function can never know about
  itself. `checkAllCronAuth` (used by `npm run test:deploy`, below) probes
  all 5 routes individually - `blog-autogen`/`digest-preview`/
  `yahrzeit-whatsapp` don't have a `memberId` no-op like `digest`/
  `in-day-reminders` do, so each gained a `?dryRun=true` short-circuit
  (famcircle#161) placed AFTER the auth check but BEFORE any real side
  effect (an AI draft, an email, a WhatsApp send) - proves the secret is
  live without the cost/risk of the real action.

## `npm run test:deploy` — the AI-12 weekly health suite (famcircle#161)

Per `~/develop/Buddy/docs/spec-periodic-tests.md`: **does-it-actually-work**
checks against the LIVE deployment, run weekly, reported to the fleet's COO
function - not "did it build". `scripts/test-deploy.ts` composes the checks
above plus two new ones into one report:

1. **CRON_SECRET live** - `checkAllCronAuth`, all 5 routes (see above).
1b. **Cron registration** - `scripts/lib/cronRegistrationCheck.ts` - Vercel's OWN
   scheduler state (`crons.definitions`), diffed against `vercel.json`'s
   expected list. Proves the STATE (Vercel will actually call the route)
   where item 1 only proves the ACTION (the route accepts a manual call) -
   see `docs`'s own control-proof-principle reference above.
1c. **Referenced scripts present** - `scripts/lib/referencedScriptsCheck.ts`
   - every `scripts/*.ts` path this repo's own `docs/` mention actually
   exists in the checkout being tested. Added 2026-08-18 after
   `check-digest-delivery.ts` AND `check-email-volume.ts` were BOTH found
   living only on `dev`, referenced by this very runbook, for days/weeks
   each - "documented" was never the same fact as "shipped". Scoped
   deliberately narrow: this only knows about references inside this
   repo's own docs/config, not an external systemd unit on another host
   (Bob's/buddy_infra's half, per the existing task split below).
2. **Connections up** - `/api/health` via `checkHealth` (already existed).
3. **Disk space** - **N/A**, documented not silently skipped: this app is
   Vercel serverless, no persistent disk it manages.
4. **Deployed-code freshness** - `scripts/lib/deployFreshnessCheck.ts`
   compares the live production deployment's git commit SHA (Vercel API,
   `meta.githubCommitSha`) against local `git rev-parse HEAD` - catches
   "migrations current while the app served a 4-day-old build". Short-vs-
   full SHA comparison handled (`tests/deployFreshnessCheck.test.ts`).
5. **Env completeness** - `scripts/lib/envCompletenessCheck.ts`, a CURATED
   list (`EXPECTED_PROD_ENV_VARS`) of vars whose absence is a genuine bug -
   not a blind scan of every `process.env.X` reference, since several real
   vars are legitimately optional by design (see the file's own comment for
   which, and why - includes a real 2026-08-16 false-positive caught and
   fixed: `JWT_ISSUER`/`JWT_KID` looked missing but are genuinely optional
   in the actual code, unlike `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`).
6. **No-naked-500** - covered by `/api/health`'s own status-code contract.

```
npm run test:deploy -- --url https://aglamaz.com
```

Needs Vercel CLI auth (the same token `vercel login` already sets up) for
items 1, 4, 5 - this is the spec's **option C** ("a central cron on ub02 runs
each project's script locally against the live URLs"), not a check running
inside the deployment's own runtime. Verified for real against production
2026-08-16: correctly reported `disk-space`/`connections-up` healthy,
correctly caught the still-live famcircle#156 outage (all 5 routes 401),
correctly flagged `deployed-code-freshness` (this fix isn't deployed yet)
and the real `AGENTS_OBSERVE_*` gap.

This is the observability half: a real check against the real URL/DB, and
proof (not just documentation) that failures are actually detected.

## Firestore export and restore

FamCircle Firestore does not currently have a second-metal backup lane unless
the export/import path below is wired up and exercised.

- Canonical procedure: [Firestore Backup and Restore](./firestore-backup-restore.md)
- Source-side helper: `scripts/firestore-backup.ts`
- npm entry points:
  - `npm run firestore:export -- --project ... --database ... --storage-project ... --export-uri ...`
  - `npm run firestore:import -- --project ... --database ... --storage-project ... --import-uri ...`

Operational requirements:

- The backup bucket must be owned by a GCP project other than the Firebase
  project.
- The bucket should apply GCS lifecycle rules for daily, monthly, and yearly
  export retention.
- The restore path must be validated in a scratch project before anyone treats
  it as proven.

## JWT_PRIVATE_KEY / EMAIL_TRACKING_TTL_SECONDS — do not "fix" this TTL

`src/services/EmailTrackingService.ts` signs the per-copy open/click tracking
token (`signEmailTrackingToken`, the F7 email-open-analytics pixel — see
`AH#699`-style decision logging convention, Agla-requested measurement that
proved real digest opens in the wild) with `EMAIL_TRACKING_TTL_SECONDS = 400
* 24 * 60 * 60` — **~13 months, deliberately, not an oversight.** Every
outgoing email (digest, in-day reminder, tag-notification, blessing-invite,
blog-review-decision, blog-autogen-admin) embeds one, and it must still
verify whenever the recipient eventually opens that specific email - which
could be months later. A shorter "hygienic-looking" TTL would silently break
tracking on any email older than the new window, and because JWT
verification fails closed, a broken pixel produces the SAME "0 opens"
signal as a real non-open — nobody would notice the regression from the
data alone (flagged by Buddy, 2026-08-05, while auditing whether
`JWT_PRIVATE_KEY` is in secrets custody).

This also means `JWT_PRIVATE_KEY` is a long-lived-in-the-wild signing key:
rotating or losing it does not break the app (a fresh RSA keypair can be
minted anytime, new tokens sign immediately) but it DOES silently
invalidate every already-issued token - auth sessions (≤30d), the
famcircle#138 read-only magazine token (14d), reminder-preference links
(14d), and up to ~13 months of already-embedded tracking tokens, with no
registry of how many are outstanding. Nothing about this is broken as of
2026-08-05 (the key is live on Vercel and working); the gap is that it has
no counterpart in `secrets/env/aglamaz-com.production.env` custody, so
recovery after a lost/misconfigured Vercel project would force a mass,
unsized invalidation. Tracked as a custody-backfill item, not urgent.

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
  `scripts/uptime-check.ts` + `scripts/check-digest-delivery.ts` +
  `scripts/check-cron-auth.ts` + `scripts/test-deploy.ts` (AI-12, composes
  the others plus deployed-code-freshness and env-completeness) + their
  tests + this runbook.
- **buddy_infra side (separate task, different repo, not yet built for any of
  the standalone monitor: checks):** a scheduled runner per check (systemd
  timer/cron, matching the fleet's existing `db_dr_*` + healthchecks.io
  dead-man's-switch convention), routing a failing check to whichever
  lane/session owns FamCircle, and the Medic permission-grant for that lane
  if it doesn't already hold it — needs Agla's authorization and should be
  filed as its own `buddy_infra` task rather than attempted here.
  `check-cron-auth.ts`/`test-deploy.ts` additionally need their runner to
  obtain the CURRENT `CRON_SECRET` each run through Tzach/Custodian's
  sanctioned credential-read path (NEVER `vercel env pull` - a known
  SSOT-corrupter as of 2026-08-18, forbidden fleet-wide) and pass it in via
  the `CRON_SECRET` env var - they cannot use a cached/baked value without
  defeating their own purpose. Vercel API/CLI access (read-only, metadata/
  key-names only, no value decryption) is separately needed for the
  env-var-presence list, deploy freshness, and cron-registration checks.
  `npm run test:deploy` specifically is spec'd (AI-12) to
  run WEEKLY, reported to the fleet's COO function - a separate cadence and
  destination from the other per-incident-class monitors above.
