# Spec: Family Notification Reminders (birthdays + yahrzeit)

Status: **draft, not yet implemented** — companion task `famcircle#5`.

## Goal

Engage family members via email:
- **Weekly digest** of birthdays coming up.
- **Yahrzeit (death-anniversary) reminder** ~1 month in advance — these matter more, people plan around them (visiting a grave, lighting a candle, gathering family).
- Each family member can **opt out per topic** (`birth` / `death`) independently — someone may want birthday cheer but not be reminded of a loss, or vice versa.

## Delivery channel — decided

**Resend (transactional)**, not Listmonk, not raw Gmail SMTP. Per Buddy (2026-07-13):
- These are event-triggered, per-recipient personalized, per-topic-opt-out sends — a transactional pattern, not a newsletter campaign. Listmonk's list-level unsubscribe doesn't map to per-topic opt-out.
- Raw `family.app.core@gmail.com` SMTP (today's `GmailService`, see `src/services/UserNotificationService.ts`) has a ~500/day cap and weaker deliverability guarantees — not acceptable for something as time-sensitive and emotionally important as a yahrzeit reminder.
- Buddy is provisioning a FamCircle-branded verified Resend domain (`mail.famcircle.org`, isolated from the existing `news.aglamaz.com` marketing domain) and will hand over the From-address + API key (`secrets/resend.env` custody).
- This is a **new, separate send path** from the existing `GmailService`/pug-template flow used for welcome emails and admin pending-member notices — those stay on Gmail; only these reminder emails move to Resend.

## Data model additions

### `notificationPreferences` (new Firestore collection, or a subcollection under each `members` doc — TBD at implementation, subcollection `members/{memberId}/preferences/notifications` is likely cleanest to keep it doc-scoped)

```ts
interface NotificationPreferences {
  memberId: string;
  siteId: string;
  birthOptOut: boolean;   // default false = subscribed
  deathOptOut: boolean;   // default false = subscribed
  updatedAt: Timestamp;
}
```

Default (no doc present) = subscribed to both. Written only when a member actually opts out, or on first send (so the "manage reminders" page has something to read/write against).

### `reminderSends` (new collection — dedupe/idempotency log)

Mirrors the pattern already used by `NotificationRepository` (`src/repositories/NotificationRepository.ts`, collection `sentMessages`) but keyed for exact-once-per-occurrence delivery:

```ts
interface ReminderSend {
  id: string;                  // `${memberId}_${anniversaryEventId}_${year}_${topic}`
  memberId: string;
  siteId: string;
  anniversaryEventId: string;
  topic: 'birth' | 'death';
  occurrenceYear: number;
  sentAt: Timestamp;
}
```

The daily job checks this collection before sending — if a doc with that deterministic ID exists, skip. This also naturally handles job re-runs / retries without double-sending.

## Reminder computation

Source of truth: `AnniversaryEvent` via `AnniversaryRepository` (`src/repositories/AnniversaryRepository.ts`). Two lookahead windows, computed once daily:

- **Birthdays** (`type: 'birthday'`): events occurring in the **next 7 days**. Weekly digest = "here's what's coming up this week" — computed daily but only *sent* on a fixed weekday (e.g. Sunday), OR computed+sent daily as a rolling 7-day-out digest. **Open question for Agla**: fixed weekly send day, or rolling daily digest of the next 7 days? Recommend fixed weekly (e.g. Sunday) — matches "weekly reminder" literally and avoids inbox fatigue.
- **Yahrzeit** (`type: 'death'`): events occurring in **exactly ~30 days** (a single reminder per occurrence, not a repeating countdown). Must read from `hebrewOccurrences` for `useHebrew` events, or the plain `month`/`day`/`isAnnual` fields for Gregorian-tracked ones.
  - **Hard dependency: `famcircle#4`** (the Hebrew-occurrence horizon bug) must ship first — otherwise the lookahead query for `useHebrew` events dated in the past (which is the common case for a yahrzeit) will miss the very occurrence being reminded about, for the same reason it doesn't show on the calendar today.

Both windows need a **per-site, per-member recipient list**: every non-pending `IMember` of the site with `email` set and no matching opt-out in `notificationPreferences`.

## Scheduling

A daily scheduled job (Vercel Cron hitting an internal API route, e.g. `src/app/api/cron/reminders/route.ts`, guarded by a cron-secret header — same pattern as any other Vercel Cron route in this repo) that, per active site:
1. Runs `ensureHebrewHorizonForYear` if needed (already exists, `AnniversaryRepository.ts:262`).
2. Computes the two lookahead sets above.
3. For each (member, event) pair not opted out and not already in `reminderSends`, renders a Resend email and records the send.

## Email content / unsubscribe

- Template per topic (pug, mirroring `src/templates/user-notification/`), site-branded (`siteName`/`platformName`, same as `UserNotificationService.renderTemplate`).
- Each email carries a **per-topic, no-login "manage reminders" link** (signed token, e.g. `/api/notifications/preferences?token=...`) that flips `birthOptOut`/`deathOptOut` for that member — this is the actual per-topic opt-out mechanism (app-level, not Resend/Listmonk list-unsubscribe).

## Open questions for Agla

1. Fixed weekly send day for birthdays (recommend Sunday), or rolling 7-day digest sent daily?
2. Exact yahrzeit lead time — "about a month" — 30 days flat, or align to the 1st of the Hebrew month prior? (Flat 30 days is simpler and matches what was asked; flagging the alternative in case it matters for the Hebrew-calendar-literate audience.)
3. Should the digest cover **all** upcoming events for the family in the window, or only for accounts opted in — i.e. does a birthday digest include the death-anniversary's related person data (photo, blessing page link) the same way the calendar view does?

## Dependencies

- `famcircle#4` (Hebrew-occurrence horizon fix) — blocking for yahrzeit accuracy.
- Buddy: `mail.famcircle.org` Resend domain verification + API key handoff — blocking for any send.
