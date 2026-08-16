/**
 * Env-completeness check (famcircle#161, AI-12 test list item 5).
 *
 * "Catches the AGENTS_OBSERVE_* zero-set case" per spec-periodic-tests.md - a var whose
 * consuming code gracefully no-ops when unset (so nothing crashes) can still be a real
 * gap nobody would otherwise notice. This is a CURATED list, not a blind scan of every
 * `process.env.X` reference in the repo - several real env vars are legitimately
 * optional by design (OPENAI_API_KEY gates BlogAutogenService.isEnabled(), WABA_ vars
 * known-absent per famcircle#142, DROPBOX_ and GENI_ vars are separate integrations not
 * core to the app, JWT_ISSUER/JWT_KID both have explicit `|| undefined`-shaped fallback
 * handling in src/auth/tokens.ts:43 and src/auth/jwt.ts:59 - confirmed both genuinely
 * unset in prod 2026-08-16 and auth still works, so they're correctly optional, unlike
 * JWT_PRIVATE_KEY/JWT_PUBLIC_KEY which have no fallback) and would just be noise here.
 * Only vars whose ABSENCE is a real bug belong in EXPECTED_PROD_ENV_VARS.
 */

export interface ExpectedEnvVar {
  name: string;
  /** Why this must be set in production - shown in a failure report. */
  reason: string;
}

export const EXPECTED_PROD_ENV_VARS: ExpectedEnvVar[] = [
  { name: 'CRON_SECRET', reason: 'gates all 5 Vercel cron routes (famcircle#156)' },
  { name: 'FIREBASE_PROJECT_ID', reason: 'Firebase Admin SDK init - every DB read/write' },
  { name: 'FIREBASE_CLIENT_EMAIL', reason: 'Firebase Admin SDK init - every DB read/write' },
  { name: 'FIREBASE_PRIVATE_KEY', reason: 'Firebase Admin SDK init - every DB read/write' },
  { name: 'JWT_PRIVATE_KEY', reason: 'every access/refresh token this app issues or verifies' },
  { name: 'JWT_PUBLIC_KEY', reason: 'same' },
  { name: 'RESEND_API_KEY', reason: 'all outbound transactional email (digest, reminders, blog review)' },
  { name: 'RESEND_FROM_EMAIL', reason: 'same' },
  { name: 'GMAIL_CLIENT_ID', reason: '/api/health treats Gmail as a critical service' },
  { name: 'GMAIL_CLIENT_SECRET', reason: 'same' },
  { name: 'GMAIL_REFRESH_TOKEN', reason: 'same' },
  {
    name: 'AGENTS_OBSERVE_INGEST_URL',
    reason: "fault reporting for cron 4xx/5xx (famcircle#160) - confirmed unset 2026-08-16, no-ops silently without it",
  },
  { name: 'AGENTS_OBSERVE_TOKEN', reason: 'same - confirmed unset 2026-08-16' },
  { name: 'AGENTS_OBSERVE_PROJECT_ID', reason: 'same - confirmed unset 2026-08-16' },
];

export interface EnvCompletenessResult {
  healthy: boolean;
  missing: ExpectedEnvVar[];
}

export interface EnvCompletenessDeps {
  /** Env var NAMES currently set in production - never values, this check must never see a secret. */
  listSetProductionEnvKeys(): Promise<Set<string>>;
}

export async function checkEnvCompleteness(
  expected: ExpectedEnvVar[],
  deps: EnvCompletenessDeps,
): Promise<EnvCompletenessResult> {
  const setKeys = await deps.listSetProductionEnvKeys();
  const missing = expected.filter((e) => !setKeys.has(e.name));
  return { healthy: missing.length === 0, missing };
}
