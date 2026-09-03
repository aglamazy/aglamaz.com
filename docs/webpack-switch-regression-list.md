# Turbopack → webpack build switch — regression checklist (famcircle#170)

**Amendment, 2026-09-03:** the webpack switch below fixed two real, unrelated
route-export bugs (see below) and was worth keeping, but it did NOT fix the actual
`/blog` 500 — the same `ERR_REQUIRE_ESM` failure occurred identically under webpack,
tracing to Vercel's own runtime rather than either bundler. The real fix was removing
`jsdom` from the dependency graph entirely (swap `isomorphic-dompurify` →
`sanitize-html`). See `docs/turbopack-jsdom-esm-interop.md` for the corrected writeup.
This checklist is kept for its regression-verification value on the bundler switch
itself, which remains in effect.

**Original context.** `next build` (no flag) currently uses Turbopack, which cannot
correctly run jsdom's dependency tree (see `docs/turbopack-jsdom-esm-interop.md` for
the mechanism) — this is what's kept `/blog` on a live 500 since 2026-08-31. Building with
`next build --webpack` compiles clean (confirmed 2026-09-02/03, all 55 pages
generated) and is the intended fix. This list exists so that switch is a **20-minute
verification against a known list**, not a hopeful deploy — per Buddy's hold decision
on famcircle#170.

**Before switching:** change `package.json`'s `"build"` script to `"next build
--webpack"` (or set `NEXT_PRIVATE_LOCAL_WEBPACK=1` / whatever the pinned mechanism
ends up being — confirm the flag survives Vercel's own build invocation, not just a
local `next build` call, since Vercel runs its own `vercel build` wrapper).

## Two real bugs already found and fixed by switching (evidence, not open items)

Both fixed and committed (`e67cb8a`, held pending this switch — not yet pushed):

1. **Route export validation.** Two blessing routes exported test-mock-injection
   helper functions (`__setMockBlessingPageRepository` etc.) directly from the route
   file — not a valid Next Route export. Turbopack let it through silently; webpack's
   build correctly rejected it. Fixed by moving the override state to sibling
   `testOverrides.ts` files.
2. **Dead sync-params union.** `blessing/[slug]/route.ts`'s `GET` typed `params` as
   `Promise<...> | {...}` — Next 16's App Router always passes params as a Promise:
   the sync arm was dead code, and webpack's route-shape check rejected the union.
   Simplified to `Promise<...>` only.

**Grepped for the same union-params pattern across all of `src/app/api`** — these
were the only two files affected. Not proof there are zero other Turbopack-hidden
defects, but the search that would find the *same class* of bug came up clean.

## Priority 1 — the actual incident (jsdom / isomorphic-dompurify)

Grepped `isomorphic-dompurify`/`DOMPurify` usage — exactly 4 call sites, all in the
blog feature. These are the routes the original 500 was in, and the ones most likely
to still misbehave in some way webpack doesn't fully replicate either:

| Route | What "still works" means |
|---|---|
| `/[locale]/blog` (public listing, all 4 locales) | 200, real post titles render, no error page |
| `/[locale]/blog/[id]` (public single post) | 200, sanitized HTML body renders (check for literal `<script>` tags surviving — would mean DOMPurify silently no-op'd, not just crashed) |
| `/app/blog` (admin list) | loads under a real admin session, posts list renders |
| `/app/blog/new`, `/app/blog/[postId]/edit` | rich-text editor loads, save round-trips through the sanitizer without 500 |
| `/api/site/[siteId]/blog/public`, `/api/site/[siteId]/blog/public/[postId]` | 200 JSON, sanitized `content` field present and non-empty |

## Priority 2 — load-bearing, customer-facing, no auth required

Anyone outside the family can hit these; a regression here is public-facing, not just
internal:

- `/[locale]`, `/[locale]/contact`, `/[locale]/privacy`, `/[locale]/terms` — 200, real
  site content (not the "Site Under Construction" fallback — that means site
  resolution broke, a different failure mode worth distinguishing).
- `/public/blessing-view/[token]`, `/public/memorial/[slug]` — 200 for a real token/slug,
  404 for an invalid one (not 500).
- `/auth/login`, `/auth/signup`, `/auth/invite/[token]` — pages render; a real signup/
  login round-trip is the deeper check but page-load-without-500 is the floor.
- `/robots.txt`, `/sitemap.xml` — 200, valid XML/text (sitemap has been broken since
  2025-11-26 for an unrelated reason — Shofar's finding — so "still broken the same
  way" is an acceptable outcome here, "500" is not).
- `/og` — 200, valid image.

## Priority 3 — cron routes (already covered by `npm run test:deploy`)

All 5 already get checked by the existing `cron-secret-live` test:deploy check
(`/api/cron/{digest,in-day-reminders,blog-autogen,digest-preview,yahrzeit-whatsapp}`)
— re-run `npm run test:deploy` after the switch, don't hand-verify these separately.

## Priority 4 — authenticated app routes (spot-check, not exhaustive)

These need a real member session to test meaningfully; a full pass isn't realistic in
20 minutes. Spot-check the ones with the most write-path risk (a silent-swallow bug
here corrupts data, not just a broken page):

- `/app` (dashboard), `/app/calendar`, `/app/photos`, `/app/family` — load without 500.
- `/api/site/[siteId]/anniversaries*`, `/api/site/[siteId]/blessing-pages/*` — one
  real create + one real read round-trip each (these are the two feature areas
  touched by tonight's other live fixes, #168/#170's own history).
- `/api/site/[siteId]/members*`, `/api/site/[siteId]/pending-members*` — one read.

## Priority 5 — everything else (~100 remaining API routes)

Not individually itemized here — these are lower-traffic admin/settings/tracking
routes (email tracking, dropbox import, geni integration, notification preferences,
etc.). The generic check: **the build itself must list all of them** (compare
`next build --webpack`'s route listing against Turbopack's — any route that silently
disappears from the list is the real red flag, not a route that merely 500s on a
call it was already 500ing on before the switch).

## What "done" looks like

1. `next build --webpack` (or its pinned equivalent) compiles clean, same route count
   as Turpobpack's listing (140 routes as of 2026-09-03).
2. Priority 1 fully verified (this is the actual incident).
3. Priority 2 fully verified (public-facing floor).
4. `npm run test:deploy` green (covers cron + the existing health/version checks).
5. Priority 4 spot-checked, not exhaustive.
6. Report to Buddy with the URL(s) checked, per the original ask on famcircle#170.
