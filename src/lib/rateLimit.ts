/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Scoped down on purpose: this repo has no shared rate-limit store (no Redis/
 * Upstash/Vercel KV — grepped for one before adding this). State lives in
 * process memory, so it only protects a single warm serverless instance; it
 * resets on cold start and isn't shared across concurrent instances. That's
 * an acceptable first line of defense against casual abuse (paired with the
 * honeypot/timing heuristic used for public writes), not a hard guarantee —
 * flagged as a known limitation rather than silently presented as complete.
 */

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const recent = (hits.get(key) || []).filter((ts) => ts > windowStart);

  if (recent.length >= options.limit) {
    hits.set(key, recent);
    return { allowed: false, remaining: 0, resetAt: recent[0] + options.windowMs };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: options.limit - recent.length, resetAt: now + options.windowMs };
}

// Test-only: clear all buckets so test cases don't bleed into each other.
export function __resetRateLimitStore() {
  hits.clear();
}
