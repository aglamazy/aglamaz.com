/**
 * Deployed-code freshness check (famcircle#161, AI-12 test list item 4).
 *
 * Catches "migrations current while the app served a 4-day-old build" - the running
 * production deployment's git commit must match what's actually on the branch that's
 * supposed to be live. Pure comparison logic, DI'd against the real fetch (which needs
 * the Vercel API) so it's testable without a live account.
 */

export interface DeployFreshnessResult {
  healthy: boolean;
  liveSha?: string;
  expectedSha?: string;
  error?: string;
}

export interface DeployFreshnessDeps {
  /** Full commit SHA of the currently-promoted production deployment, or null if none found. */
  fetchLiveProductionSha(): Promise<string | null>;
}

function shaMatches(live: string, expected: string): boolean {
  // Compare on the shorter of the two lengths - a short SHA (e.g. "1305ad9") and a full
  // 40-char SHA for the same commit must both count as a match.
  const len = Math.min(live.length, expected.length);
  return live.slice(0, len) === expected.slice(0, len);
}

export async function checkDeployFreshness(expectedSha: string, deps: DeployFreshnessDeps): Promise<DeployFreshnessResult> {
  try {
    const liveSha = await deps.fetchLiveProductionSha();
    if (!liveSha) {
      return { healthy: false, expectedSha, error: 'no production deployment found' };
    }
    return { healthy: shaMatches(liveSha, expectedSha), liveSha, expectedSha };
  } catch (error) {
    return { healthy: false, expectedSha, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
