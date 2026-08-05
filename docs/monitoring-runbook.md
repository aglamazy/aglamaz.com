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

This is the observability half: a real check against the real URL/DB, and
proof (not just documentation) that failures are actually detected.

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
  `scripts/uptime-check.ts` + `tests/uptimeCheck.test.ts` + this runbook.
- **buddy_infra side (separate task, different repo):** scheduled runner,
  healthchecks.io wiring, and the Medic permission-grant for the FamCircle-owning
  lane — needs Agla's authorization and should be filed as its own
  `buddy_infra` task rather than attempted here.
