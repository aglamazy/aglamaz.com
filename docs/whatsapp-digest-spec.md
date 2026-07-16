# WhatsApp Digest — Content Scope Spec

## Goal

Define the content scope and cadence for the FamCircle WhatsApp digest message.
The WA message is deliberately **shorter than the email magazine**: plain-text,
thumb-friendly, sent weekly (Friday) instead of monthly. It is a condensed
surface — a nudge to open the site — not a full recap.

**Send-side dependency**: actual delivery requires WABA (WhatsApp Business API)
integration (famcircle#28). This spec can be written and implemented ahead of
that work, but no messages will be sent until famcircle#28 is complete.

---

## Content Scope

### What's IN

| Section | Notes |
|---|---|
| **Weekly headline** | 1 sentence: "Here's what's new in [Family Name] this week." |
| **New photos** | Count only — "3 new photos added." No URLs, no previews. |
| **Upcoming events** | Birthdays / anniversaries in the next 7 days, names only. |
| **New blessings** | Count only — "2 new blessings on Grandpa Avi's page." |
| **New blog post** | Title + author only — no excerpt. |
| **CTA link** | One site link: "See it all → [site URL]" |

Total target: ≤ 300 characters of body text (excluding the CTA link), so the
message is readable in a notification preview without opening the chat.

### What's OUT (vs the email magazine)

| Excluded | Reason |
|---|---|
| Photo gallery previews / thumbnails | Not supported in WA text messages |
| Blog post excerpts / body text | Keeps message short; drives click-through |
| HTML formatting, headings, styled sections | WA is plain text only |
| Full anniversary date details | Name + "this week" is enough for a nudge |
| AI-generated narrative / editorial copy | Monthly magazine feature only |
| Unsubscribe footer / legal block | Handled at WABA opt-in layer (famcircle#28) |

---

## Cadence

| Property | Value |
|---|---|
| Frequency | Weekly |
| Day | Friday |
| Time | 09:00 subscriber local time (morning nudge before the weekend) |
| Scope | Prior 7 days of activity + next 7 days of upcoming events |
| Skip condition | No new content in the window → no message sent (no noise) |

Contrast with the email magazine: monthly, month-scoped, rich HTML, AI template
suggests a narrative layout. The WA digest is the lightweight complement —
same data sources, drastically reduced format.

---

## Data Model

No new Firestore documents are required. The WA digest reads from the same
collections as the email magazine:

- `photos` — filter by `createdAt` within the 7-day window
- `anniversaryEvents` — filter by date falling within next 7 days
- `blessings` — filter by `createdAt` within the 7-day window
- `blogPosts` — filter by `publishedAt` within the 7-day window

Subscriber phone numbers and opt-in state live in the WABA layer (famcircle#28)
and are not part of this spec.

A new optional field on the site document may be introduced later to let admins
toggle WA digest on/off per site independently of the email digest, but that
is out of scope for v0.

---

## Message Format (template)

```
[Family Name] — your weekly update 🌳

📸 [N] new photo(s) this week
🎂 Coming up: [Name1] (birthday, Fri), [Name2] (anniversary, Sun)
✍️ New post: "[Blog Title]" by [Author]
🙏 [N] new blessing(s) added

See it all → [site URL]
```

Sections with zero items are omitted entirely. A message with nothing to report
is not sent (skip condition above).

---

## Open Questions

1. **Opt-in flow**: WA requires explicit opt-in per user. Who triggers the
   opt-in request — site admin, or individual member? Depends on famcircle#28
   design.

2. **Per-subscriber locale**: Should the day/time of "this week" and event
   labels be localized? The email digest already localizes per subscriber
   (task-2632). WA should match, but the mechanism depends on how WABA
   delivers messages (famcircle#28).

3. **Admin toggle granularity**: Should WA digest be enabled/disabled at the
   site level only, or also per-member? v0 assumes site-level.

4. **Friday timing**: 09:00 subscriber local time is the candidate. Confirm
   with Agla whether this should be configurable per site.

5. **Link format**: WA renders raw URLs. Should the CTA link use a shortener or
   a tracked UTM parameter? Deferred to famcircle#28 or a later task.
