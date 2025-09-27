# Auth UX — Reduce Reauthenticate Prompts

## Summary
- Current middleware verifies access tokens on every page request and rewrites to `/auth-gate` when expired, even though client APIs can refresh tokens. This causes frequent “reauthenticate” prompts and blocks initial paint.

## Recommendations
- Soft Page Middleware: For non-API routes, if an `access_token` cookie exists, allow the page to load without immediate verification. Enforce auth on API routes (`withMemberGuard`) and during data fetches.
- Align Access TTL: Increase access token lifetime to 30–60 minutes to match UX expectations (cookie maxAge is already 120m). Keep refresh token at 30 days.
- Public-Load, Protected-Data: Treat app pages like `/calendar` as public for initial HTML; fetch protected data via guarded APIs using `apiFetch` (auto refreshes on 401).
- Centralize Client Check: Trigger a single `checkAuth()` in the client layout shell to populate user/member state once, not per page.
- Background Refresh: From the shell, silently refresh before expiry (e.g., 80–90% of TTL). Use the existing `refreshOnce` guard to avoid request storms.
- Skip Member Probe In Middleware: Remove the `member-info` call for non-API routes. Let the client or server loader fetch member info when needed.
- Strict Only Where Needed: Keep middleware strict for routes that SSR sensitive content directly into HTML; otherwise keep it soft as above.
- Clock Skew Tolerance: Allow small skew (e.g., 5–15s) when verifying tokens at the edge to avoid borderline expirations.
- Telemetry: Log refresh successes/failures and count of middleware rewrites to `/auth-gate` to measure improvement.

## Proposed Steps
- Middleware
  - [ ] Detect non-API route with token present → `NextResponse.next()` (no early rewrite)
  - [ ] Keep strict handling for `/api/**` and truly private SSR routes
- Auth Service
  - [ ] Increase `accessMin` in `api/auth/login` (e.g., 45–60)
  - [ ] Consider matching cookie `maxAge` with token TTL or keep slightly higher to allow refresh
- Client Shell
  - [ ] Fire `checkAuth()` once, store in `UserStore`
  - [ ] Add background timer: call `/api/auth/me` or `/api/auth/refresh` before TTL
  - [ ] Ensure all data loads use `apiFetch` (already refresh-aware)
- Pages/Data
  - [ ] Confirm all sensitive data comes from guarded APIs (no accidental SSR leakage)

## Acceptance Criteria
- Navigating between pages does not trigger `/auth-gate` when the cookie exists; first protected API call refreshes seamlessly.
- Token refresh happens in the background with no visible prompts.
- No unauthenticated access to protected data (API routes still enforce guard).
- Error paths still redirect to login on hard 401s (no infinite loops).

## Rollout Notes
- Start with middleware softening + longer TTL in staging.
- Monitor metrics for 3–5 days: refresh rates, rewrite counts, 401s.
- Adjust TTL and background interval based on observed churn.

## When refresh token is needed, it is done correctly, but the page is not redirected to /app