/**
 * Referenced-but-absent script check (2026-08-18, Buddy's "class question").
 *
 * Found via famcircle#159/#161: scripts/check-digest-delivery.ts and
 * scripts/check-email-volume.ts had each lived on `dev` for days/weeks, referenced by
 * docs/monitoring-runbook.md and (per Bob's audit) a live systemd unit, while genuinely
 * ABSENT from `main` - not a wrong signal, not a silent skip, the code simply was not in
 * the checkout that runs it. This is the general form: any `scripts/*.ts` path
 * mentioned in this repo's own docs or `vercel.json` should actually exist on whatever
 * branch is being checked.
 *
 * Deliberately narrow scope: this only proves "a script this repo's OWN docs/config
 * claim exists actually does" - it does NOT know about external references (a systemd
 * unit on another host, a script another repo shells out to). That half stays Bob's/
 * buddy_infra's, per Buddy's own split.
 */

export interface ReferencedScriptGap {
  scriptPath: string;
  referencedIn: string;
}

export interface ReferencedScriptsResult {
  healthy: boolean;
  missing: ReferencedScriptGap[];
}

export interface ReferencedScriptsDeps {
  /** Every `scripts/*.ts` (or similar) path this repo's docs/config claim exist, paired with where it's referenced. */
  findReferencedScriptPaths(): Promise<ReferencedScriptGap[]>;
  /** Whether the given repo-relative path actually exists in the current checkout. */
  fileExists(relPath: string): boolean;
}

export async function checkReferencedScriptsExist(deps: ReferencedScriptsDeps): Promise<ReferencedScriptsResult> {
  const referenced = await deps.findReferencedScriptPaths();
  const missing = referenced.filter((r) => !deps.fileExists(r.scriptPath));
  return { healthy: missing.length === 0, missing };
}
