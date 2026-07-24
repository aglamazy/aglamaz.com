# famcircle.org — GSC index coverage audit (2026-07-24)

Growth plane 1 (famcircle#95, follow-on from famcircle#75). First of 2 growth
workstreams — checks whether famcircle.org's public pages are actually
indexable/surfaced, and fixes the concrete problems found.

## What I could not check

I do not have Google Search Console UI/API access to the famcircle.org
property from this environment (no OAuth session, no service-account
credential wired up anywhere in this repo or in `~/develop/docs/credentials-*`).
So I could not pull the actual **Page indexing** report (indexed/excluded
counts, "Discovered — not indexed", "Crawled — not indexed", crawl errors,
etc.) — that requires a human with GSC access, or a service account added to
the property.

**Domain ownership IS verified** in GSC already — I found the
`google-site-verification=Um9Nyu_WKNCbIo4DOZ6jw6zr3Rx8iX-NCwLtiWeaFz8` TXT
record on the `famcircle.org` DNS zone via `dig`. So a GSC property for the
domain exists and *someone* (Agla, presumably) has access to it — the actual
coverage numbers just aren't reachable from here.

**Instead**, I audited the site's crawlability/indexability surface directly —
sitemap, robots.txt, rendered `<head>` on every locale, and the code paths
that generate them — since that's exactly the class of bug that produces the
GSC symptoms this task asked about ("missing sitemap entries, noindex tags
left on by accident, thin-content pages"). Findings below are evidence-based
(fetched live from https://famcircle.org, not guessed), and the one clearly
wrong bug found in the audit is fixed in this branch.

## What's live and correct

- `robots.txt` (`src/app/robots.txt/route.ts`) correctly `Allow: /`, blocks
  `/admin`, `/app`, `/auth`, `/api`, and points to the sitemap. No accidental
  blanket disallow.
- `sitemap.xml` (`src/app/sitemap.xml/route.ts`) is live and valid XML, listing
  every locale variant of: home, blog list, contact, terms, privacy, and one
  published blog author (`yaakov-aglamaz`) — 24 `<loc>` entries total on the
  live site.
- Every sampled page (`/en`, `/he`, `/tr`, `/ar`, `/en/blog`,
  `/en/blog/yaakov-aglamaz`) serves `<meta name="robots" content="index,
  follow">` — nothing is accidentally noindexed. The only `noindex` in the
  codebase is on `/api/notifications/preferences`, which is correct (an
  authenticated API route, not a public page).
- Canonical tags and hreflang alternates (`en`/`he`/`tr`/`ar` +
  `x-default`) are present and self-consistent per page
  (`src/utils/seo.ts:buildAlternates`).
- Blog content isn't paper-thin: `/en/blog` renders ~550 words of real body
  text, not a stub.

## Bug found and fixed: every page's `<title>` was forced into Hebrew

**Live evidence before the fix** (`curl -s https://famcircle.org/<locale>`):

| Locale | `<title>` before fix |
|---|---|
| en | `Demo site \| אתר הדגמה` |
| tr | `Demo sitesi \| אתר הדגמה` |
| ar | `موقع العرض \| אתר הדגמה` |
| he | `אתר הדגמה \| אתר הדגמה` (only locale where it happened to look right) |

Every non-Hebrew page's title tag had a Hebrew suffix glued onto it. That's
exactly the kind of thing that suppresses CTR on search results (Google shows
a broken-looking bilingual title, or silently rewrites it to something else),
and can read as a quality signal.

**Root cause**: `src/app/layout.tsx` (the root layout, above the `[locale]`
segment) sets the page-title template:
```ts
title: siteName ? { default: siteName, template: `%s | ${siteName}` } : undefined
```
but it fetches `siteName` via `fetchSiteInfo(siteId, DEFAULT_LOCALE)` —
and `DEFAULT_LOCALE` (`src/i18n.ts`, driven by `next-i18next.config.js`) is
**`'he'`**, unconditionally, regardless of which locale is actually being
rendered. Every child page under `[locale]` (home, blog, blog post, contact,
terms, privacy) sets a plain-string `title` (e.g. `'Family Blog – Recent
Posts'`), which Next.js substitutes into the *nearest ancestor* title
template — and the nearest template available was the root layout's
Hebrew-locked one, since `src/app/[locale]/layout.tsx` didn't define its own.

**Fix applied** (`src/app/[locale]/layout.tsx`): added a `generateMetadata`
that re-derives the title template using the locale actually being rendered
(the same `locale` value the layout already resolves for
`PublicLayoutShell`). This is a nearer layout than the root, so Next.js's
title-template resolution now uses it for every page under `[locale]/*`,
overriding the root's Hebrew-only template. Root layout is untouched (it's
still the fallback for anything outside `[locale]`, if any).

Not fixed in the same pass (flagging, not touching): `env.example` and
`.env.local.example` document the GSC verification env var as
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, but `src/app/layout.tsx` actually
reads `GOOGLE_SITE_VERIFICATION` (no `NEXT_PUBLIC_` prefix, and it doesn't
need one — the verification meta tag is server-rendered). This is currently
harmless in practice because the domain is already verified via DNS TXT, so
no functional problem — but it's a live landmine if anyone follows the
example file and expects the meta-tag path to work. Left as-is since it's
docs/env-naming, not an index-coverage issue; worth a follow-up cleanup task
if you want it tracked.

## Other observations (not bugs, just growth-relevant)

- **Coverage is thin by design, not by breakage.** The whole public surface
  is 6 route families × 4 locales = 24 URLs, and only ONE blog author/post is
  published on the demo site. If GSC's Page indexing report shows a low
  indexed count, that's an accurate reflection of a small site, not a
  technical exclusion problem. The highest-leverage growth lever here is
  **more published content** (more demo blog posts), not further crawlability
  fixes — there's nothing broken left to find in the crawl path.
- **`ar` (Arabic) is live in production** (sitemap + rendered pages) but is
  **not** in this repo's locale config (`src/constants/i18n.ts` and
  `next-i18next.config.js` both list only `['en', 'he', 'tr']`). Production
  is serving real, distinct Arabic content for `/ar/*`, so this isn't broken
  — it just means prod has diverged from what's checked into this branch (a
  newer commit added `ar` support that isn't in this worktree's history).
  Flagging as a version-drift observation, not something to "fix" here.
  Worth a quick sanity check that `ar` is intentionally supported before the
  next deploy overwrites it.
- **Every public page is `force-dynamic`** (`export const dynamic =
  'force-dynamic'` on `robots.txt`, `sitemap.xml`, and the `[locale]` layout),
  which sends `Cache-Control: private, no-cache, no-store, max-age=0,
  must-revalidate`. This is required here (multi-tenant, resolved per request
  host) and isn't an indexing blocker — Googlebot fetches fresh regardless —
  but it does mean no CDN-edge caching for crawl requests. Not worth changing
  given the multi-tenant constraint; noting only because "why is TTFB slow
  for crawlers" is a natural next question.
- **Vercel Preview Deployment indexing** — couldn't check from here (needs
  Vercel dashboard/API access, not code). If GSC ever shows duplicate content
  under a `*.vercel.app` host, that's the place to look (Vercel's Deployment
  Protection / `x-robots-tag` on previews), not this codebase's robots/meta
  logic, which only governs the production domain.

## Recommended next step

Someone with GSC UI access should pull the actual **Page indexing** report
for famcircle.org (Coverage: Valid / Excluded / Error breakdown) to confirm
the 24 sitemap URLs are all indexed as expected, and to catch anything this
static audit can't see (manual actions, mobile usability, actual crawl
errors from Googlebot's perspective). If useful going forward, I can help set
up a GSC service-account credential (same pattern as `scripts/gmail.py`) so
future audits can pull real coverage data programmatically instead of
guessing from the rendered HTML — that would need Agla to grant API access to
a service account first.
