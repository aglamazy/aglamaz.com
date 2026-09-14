# Landmines — full detail

Traps that have actually broken builds/data in this repo. Index-shaped 2026-09-14
(famcircle#174) out of `CLAUDE.md`; read the relevant section before baking a task spec
that touches that area.

## dev-port

**Dev port is 3000, hardcoded in `package.json`'s `dev` script** (`next dev -p 3000`).
Don't let a global runner silently repin it — `~/develop/docs/ports.txt` registers
FamCircle at 3000; `run.sh`'s registry matcher was itself buggy until 2026-07-14
(naive substring match false-positived on other projects' domains).

## calendar-fields

**Denormalized calendar fields**: `AnniversaryEvent` stores `date` (Timestamp) AND
separately `month`/`day`/`year` (numbers, used for querying). Never hand-edit `date`
alone (e.g. via Firestore console) — the app's own `update()` keeps them in sync, a raw
edit doesn't, and the calendar filters by `month`/`year`, not `date`.
(`src/repositories/AnniversaryRepository.ts`)

## hebrew-events

**Hebrew-tracked events**: `getEventsForMonth`'s Hebrew branch returns a *display*
object with `month`/`day`/`year`/`date` overwritten to whatever occurrence is being
shown for the queried month — NOT the event's true stored date. Any caller that needs
the real original date (e.g. an edit form) must use `originalDate`/`originalMonth`/
`originalDay`/`originalYear` instead, or it will silently corrupt the stored date on
next save. The true original occurrence must always be resolvable independent of the
lazy `hebrewOccurrences` horizon computation - never make it "on demand only."

## draft-filter

**List endpoints must filter drafts once `status` exists** (famcircle#6 introduces
`status: 'draft'|'in_review'|'published'` on `IBlogPost`) - every existing list path
(`getBySite`/`getByAuthor`, public sitemap + blog list routes) needs an implicit
`status === 'published'` filter (missing `status` = published, for back-compat) or
drafts/in-review posts leak into public feeds.

## i18n

**i18n**: a missing key falls back to the inline `defaultValue` in code (English)
regardless of active locale - this silently breaks Hebrew's RTL layout (English text
forced right-to-left). New user-facing strings need entries in ALL FOUR locale files
(`public/locales/{en,he,tr,ar}/common.json`) - `ar` is easy to miss since it's not
mentioned elsewhere in this doc, but `next-i18next.config.js` has it in
`SUPPORTED_LOCALES` and it's just as live as the other three.

## fast-refresh

**Dev-server Fast Refresh mid-test**: editing source files while a browser session has
an in-progress form open can reset that form's React state via HMR remount, and a
stale-closure submit handler can silently no-op (no network request, no visible error
change). If a form submit looks like it did nothing, hard-reload before concluding it's
a real bug.

## dotted-keys

**Firestore `.set(obj, {merge: true})` does NOT nest dotted-string keys** - only
`.update(obj)` does. `{'locales.he.title': x}` passed to `.set(..., {merge:true})`
creates a garbage top-level field literally NAMED `"locales.he.title"` (dot and all),
not a nested `locales.he.title` path - Firestore only treats dots as path separators
for `.update()` (or `FieldPath` key objects). This bit `BlogRepository.upsertLocale`/
`markTranslationRequested` for real (famcircle#105): translated content silently
landed in dead sibling fields nothing ever read, so every Hebrew view re-triggered
translation - one post reached 155 wasted OpenAI calls before it was caught. Any
helper building `{'a.b.c': value}`-shaped objects (`makeLocaleUpdate`-style) MUST go
through `.update()`, never `.set(..., {merge:true})`. The shared `LocalizationService`
(`saveLocalizedContent`/`buildLocalizedUpdate`) already gets this right - prefer
reusing it over hand-rolling another dotted-key writer.

## storage-cors

**Never `fetch()` a Firebase Storage download URL from the browser** - the bucket
has no CORS configuration (no `cors.json` ever applied via `gsutil`), so a
programmatic cross-origin `fetch()`/`XHR` to `firebasestorage.googleapis.com` is
silently blocked by the browser. An `<img src=...>` tag pointed at the SAME URL
works fine (CORS doesn't apply to image loads), which is exactly why this bug
passed `tsc`/`next build`/manual smoke and only surfaced when a real user tried it
(famcircle: `EventFormContent.tsx`'s existing-photo re-crop flow, 2026-08-01 -
needed the raw image bytes for a `<canvas>` crop, not just to display it). If you
need Storage image BYTES client-side (not just to display the image), proxy the
fetch through a same-origin API route instead (server-to-server `fetch()` has no
CORS restriction) - see
`src/app/api/site/[siteId]/anniversaries/[anniversaryId]/photo/route.ts` for the
pattern.
