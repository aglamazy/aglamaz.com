// Pre-deploy step (famcircle#171/#182): register this app's dead-man signals on the Cockpit hub.
// Chained into `npm run build` (Dasi's note: Buddy docs/deadman-deploy-registration-note.md, contract section 2).
//
// Order is mandatory: the check is registered and confirmed BEFORE anything pings it (an unregistered ping is a
// 404 and an alert). Reads deadman.signals.json (logical names, never slugs) and the slug of each signal from
// DEADMAN_SLUG_<name with - as _>. Prints names and counts only, never a slug or the token.
//
// Runs only on a production build (VERCEL_ENV=production) or when DEADMAN_REGISTER=1. Previews and local builds
// skip, so a preview never writes to the production hub.
//
// What a failed registration does to the build (Dasi's table):
//   local misconfiguration (no token / no lane / no checks / a missing slug)  -> FAIL the build
//   hub or network said no (refused, unconfirmed, error, incl. 409)          -> pass with a loud warning
// TODO(famcircle#171): also reportFault() the second case once agents-observe reporting is wired.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerDeadman } from "agents-observe";

const production = process.env.VERCEL_ENV === "production" || process.env.DEADMAN_REGISTER === "1";
if (!production) {
  console.log("[register-deadman] not a production build - skipped");
  process.exit(0);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "deadman.signals.json"), "utf8"));

const missing = [];
const checks = cfg.signals.map((s) => {
  const envName = `DEADMAN_SLUG_${s.name.replace(/-/g, "_")}`;
  const slug = process.env[envName];
  if (!slug) missing.push(envName);
  return { slug, period_seconds: s.period_seconds, grace_seconds: s.grace_seconds };
});
if (missing.length > 0) {
  console.error(`[register-deadman] FAIL: missing env ${missing.join(", ")}`);
  process.exit(1);
}

const out = await registerDeadman({ owning_lane: cfg.owning_lane, checks });

if (out.ok) {
  console.log(`[register-deadman] ok: created=${out.created?.length ?? "?"} existing=${out.existing?.length ?? "?"} of ${checks.length}`);
  process.exit(0);
}
if (out.reason === "disabled") {
  console.log("[register-deadman] disabled (AGENTS_OBSERVE_DISABLED) - skipped");
  process.exit(0);
}
if (["no-token", "no-lane", "no-checks"].includes(out.reason)) {
  console.error(`[register-deadman] FAIL: ${out.reason} - this app's deploy config is wrong`);
  process.exit(1);
}
console.warn(`[register-deadman] WARN: registration not confirmed (reason=${out.reason}${out.status ? ` status=${out.status}` : ""}) - deploy continues, the checks are NOT registered`);
process.exit(0);
