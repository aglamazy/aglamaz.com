# Spec: Family Digest Formats (magazine cadence + in-day reminders)

Status: **draft, spec'd 2026-07-20** — supersedes the lead-time-reminder half of
`docs/notifications-reminders-spec.md` (see §5 below). Companion epic: `famcircle#8` (family-keeper).

## Goal

Two formats, inspired directly by Geni.com's two email types (weekly roundup vs. same-day
reminder), covering all three anniversary types this app tracks: **birthday, death (yahrzeit),
wedding**.

1. **Magazine** — the existing digest (content compiler + template, already built for epic 8)
   gets a per-member cadence choice instead of a fixed monthly send.
2. **In-day reminders** — a new, simpler mechanism: fires only on days that actually have an
   occasion, covering all three types uniformly (no per-topic granularity).

## 1. Magazine — cadence becomes a member preference, not a fixed schedule

- Member-facing control (profile / NotificationPreferences): a single 3-way selector —
  **cadence: `weekly` | `monthly` | `none`** (`none` = off; not a separate enable toggle).
- Content: unchanged — the existing `DigestCompilerService` (queries `AnniversaryRepository` +
  `GalleryPhotoRepository`) already pulls all anniversary types for a period, not just
  birthday/death, so no compiler change is needed for the wedding-type gap here.
- **Window**: `weekly` = this week + forward through ~1 month out (a rolling "coming up"
  preview). `monthly` = the existing month-in-review behavior, unchanged.
- **This is the mechanism that satisfies "memorial days need a longer alert, in case family
  wants to gather"** (Agla, 2026-07-20): a weekly-cadence subscriber sees a memorial 3-4 times
  in the run-up to the date via the rolling window, well before the day itself. No separate
  advance-reminder send is needed for this purpose anymore (see §5).
- One send mechanism, two cadence values — NOT two separate systems. Avoid building a parallel
  "weekly digest service" next to the monthly one; this is a cadence parameter on the existing
  compiler + cron, resolved per-member at send time.

## 2. In-day reminders — new, simple, unified across types

- Member-facing toggle: **on/off** (single toggle, default **on**, matches this repo's
  opt-out-by-default convention).
- Fires **only on days where the member has at least one occurrence** (birthday, death, or
  wedding anniversary) among people they'd see on the calendar — silent on every other day, not
  a guaranteed daily send.
- No per-topic opt-out (no separate birthday-vs-yahrzeit granularity) — Agla's framing was
  explicitly one toggle, "just for days there is something."
- Content: short, same-day nudge (closer to Geni's image-7 format: "X is celebrating today" +
  a CTA), not the full magazine content.

## 3. Types covered

`birthday`, `death`, `wedding` — all three, in both formats. Wedding currently has **zero**
reminder-system support (the existing reminders cron only special-cases `'birth'|'death'`
topics) — this is real new scope, not a trivial extension, since wedding-anniversary content
(whose anniversary, which couple, how to phrase it) doesn't currently flow through any
notification path.

## 4. Data model changes

`NotificationPreferences` (`src/repositories/NotificationPreferencesRepository.ts`) — replace
the current `{ birthOptOut, deathOptOut }` shape with:

```ts
interface NotificationPreferences {
  memberId: string;
  siteId: string;
  magazineCadence: 'weekly' | 'monthly' | 'none'; // default 'monthly'; 'none' = off
  inDayRemindersEnabled: boolean; // default true
  updatedAt: Timestamp;
}
```

**Revised 2026-07-20** (corrects famcircle#50's already-shipped shape): magazine is ONE field,
not an enable-boolean plus a separate cadence — `'none'` IS the off state. Do not carry a
separate enabled flag alongside `magazineCadence`; that's redundant and was the mistake in the
first implementation. Profile UI is a single 3-way control (weekly/monthly/none), not a
toggle-plus-conditional-dropdown.

This is a breaking shape change from the current `birthOptOut`/`deathOptOut` fields. Existing
preference docs (if any exist in Firestore already) need a migration or a back-compat read path
— check before assuming a clean cutover; `famcircle#43`'s no-login signed-token unsubscribe
link (already built) should be re-pointed at the new fields rather than rebuilt, the token
mechanism itself doesn't change.

## 5. What this replaces

`docs/notifications-reminders-spec.md`'s lead-time reminder mechanic (7-day birthday lookahead,
30-day yahrzeit lookahead, dedicated daily cron computing "due" reminders per occurrence) is
**retired**, replaced by the combination of §1 (weekly magazine's rolling window covers the
advance-notice need) and §2 (in-day covers the day-of nudge). The existing
`ReminderComputationService` / `ReminderSendsRepository` / the birth/death-only branch of
`src/app/api/cron/reminders/route.ts` should be considered superseded, not extended — do not add
wedding-type support to that lead-time cron; build wedding support into §1/§2 instead.

**Impact on already-completed epic-8 tasks** (flagging so nothing silently drifts):
- `famcircle#26` ("verify birth/death reminders actually work end-to-end") — its target
  (the lead-time cron) is being retired. Re-scope or cancel once §1/§2 are built and proven.
- `famcircle#43` (opt-out link fix) — mechanism (signed token) stays, but must be re-pointed at
  the new preference fields once they exist.
- `famcircle#23` (monthly digest cron) — becomes the cadence-aware cron from §1, not a separate
  new build.

## 6. Template design — validated 2026-07-20 against real Aglamaz data

Previewed against real events/photos and corrected by Agla:

- **No "warning" styling for memorials.** Do not visually distinguish a memorial from other
  events (no highlighted/note-box treatment) — list it inline with everything else, same
  weight. The "longer alert" comes from *when* it appears (via §1's rolling window), not from
  how it's styled.
- **Every event row shows a photo.** `AnniversaryEvent.imageUrl` (already exists) renders next
  to the event name/date in both the weekly digest and the in-day reminder.
- **The "new photos" section shows actual thumbnails**, not just a count — pull real URLs from
  `GalleryPhoto.imagesWithDimensions[0].url` (already exists), render a small grid.
- **Everything is clickable** — event rows and photo thumbnails link into the site (calendar /
  gallery), not just the one bottom CTA button.

## 7. Magic login — no-auth read access from email links (new, enqueued 2026-07-20)

Every link in these emails (event rows, photo thumbnails, the manage-preferences footer link)
is useless if it dumps the recipient on a login wall — most people read email logged out on
that device. Needs a signed read-only token, generalizing the pattern already proven by
`famcircle#43`'s unsubscribe link and the blog review-token flow.

- **Token grants READ access only** — viewing the calendar, gallery, a memorial page, etc., as
  that member, without a Firebase Auth session.
- **Any WRITE action still requires full login** — posting a blessing, editing anything,
  changing settings beyond what a dedicated manage-link token explicitly allows. The token must
  never be accepted by a mutating route as sufficient auth.
- Concretely: a middleware/guard check that, absent a real session, looks for a valid signed
  read-token (memberId + siteId + expiry, same signing approach as the existing token flows) and
  populates a read-only member context; existing `withMemberGuard`-protected write routes are
  untouched and keep requiring the real session.
- Directly fixes the footer manage-link bug found during preview review (§6): it was pointing at
  `/app/profile`, which requires login — defeating the point of a one-click unsubscribe/manage
  link. Once this lands, that link should use the signed-token route instead.

## Open questions

- In-day reminder delivery channel: email only for v1 (matches magazine), or does this want
  WhatsApp from day one given `#30`'s yahrzeit-sync-send groundwork already exists? Recommend
  email-only for v1, WA is still gated on the WABA (deprioritized, per Agla 2026-07-20).
- Wedding-anniversary content: whose "voice" does the digest/reminder speak in for a couple's
  anniversary vs. an individual's birthday? Needs a copy/template decision, not just data
  plumbing — flagging so whoever builds §3 doesn't invent tone unilaterally.
