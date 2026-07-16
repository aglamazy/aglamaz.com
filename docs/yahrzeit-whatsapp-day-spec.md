# Yahrzeit-Day Synchronized WhatsApp Send — Spec

## Goal

On the day of a yahrzeit, send a single synchronized WhatsApp message to every
active family member simultaneously. This is the differentiated bet ("the
original wedge"): FamCircle creates a shared moment of remembrance — not an
ambient digest, not an individual advance reminder.

**Dependencies**:
- famcircle#28 (WABA integration): actual delivery requires WABA API credentials
  and member phone numbers stored in Firestore. The service scaffolding below
  is complete; delivery is gated on famcircle#28.
- famcircle#29 (content scope): this spec applies the plain-text, ≤300 char
  constraint defined there.

---

## Concept: Synchronized vs. Individual

| Dimension | Email reminder (existing) | WA yahrzeit-day (this spec) |
|---|---|---|
| Timing | 30 days in advance | On the exact yahrzeit day |
| Audience | Each member individually | All active members simultaneously |
| Tone | Advance notice / personal | Shared moment / family gathering |
| Channel | Email via Resend | WhatsApp via WABA |
| Message per member | Personalized (member name) | Identical to all (family name) |
| Skip if sent | Per member/event/year | Per member/event/year |

The simultaneity is the point: when every family member gets the same
WhatsApp at the same moment on the same day, it creates a shared prompt to
react, respond, and connect — the "gathering on the same day" promised in the
Quartet spec.

---

## Trigger & Cadence

| Property | Value |
|---|---|
| Frequency | Daily check |
| Cron time | 07:00 UTC (one hour after email-reminder cron) |
| Trigger condition | `anniversaryEvents.type === 'death'` with Gregorian occurrence = today |
| Hebrew dates | Mapped via `hebrewOccurrences` (same as email reminder) |
| Skip condition | No yahrzeit today → no message sent |
| Dedup | Per member × event × year — never sends twice |

---

## Message Format

Plain text only. Target: ≤ 300 characters of body (excluding site URL).
Sections are hard-coded — no AI template, no HTML, no media.

### Hebrew (default for FamCircle)

```
🕯️ היום יארצייט של [שם]
משפחת [שם המשפחה] נזכרת יחד היום.

[site URL]
```

### English

```
🕯️ Today is [Name]'s yahrzeit
The [Family Name] family remembers together today.

[site URL]
```

### Turkish

```
🕯️ Bugün [İsim]'in yahrzeiti
[Aile Adı] ailesi bugün birlikte anıyor.

[site URL]
```

The locale is determined per-member (`member.defaultLocale`). The event name
(`[Name]`) is taken from the member's locale view of the anniversary event
(using the existing localization pipeline).

---

## Data Model

No new Firestore collections beyond the dedup store.

### Dedup: `whatsappSends` collection

One document per (memberId × eventId × year × topic) prevents double-sends
across cron runs and retries.

```
whatsappSends/{memberId}_{eventId}_{year}_{topic}
  memberId:  string
  eventId:   string
  siteId:    string
  year:      number
  topic:     'yahrzeit_wa'
  sentAt:    Timestamp
```

### Phone numbers

Member phone numbers are stored by the WABA layer (famcircle#28). This spec
does not define that storage — the cron route receives phone numbers from
whatever interface famcircle#28 exposes.

---

## WABA Delivery (stub until famcircle#28)

The cron route calls `YahrzeitWhatsAppService.sendMessage()`. That method:

1. Checks `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` env vars.
   Missing → logs a warning and returns `{ sent: false, reason: 'waba_not_configured' }`.
2. POSTs to `https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages`
   (Meta WhatsApp Cloud API) with `type: "text"` and the localized body.
3. Returns `{ sent: true }` on 200, logs the error and returns `{ sent: false }`
   on any non-200.

---

## Open Questions

1. **Per-member opt-out**: Should members be able to opt out of WA yahrzeit
   sends independently of email reminders? v1 assumes yes — the same
   `notificationPreferences` collection (famcircle#11) should add a
   `yahrzeitWaOptOut` flag.

2. **Send time per subscriber timezone**: 07:00 UTC is the current candidate.
   Should the send be scheduled per subscriber timezone so it always arrives
   at ~09:00 local? This requires queuing, not a single cron. Deferred.

3. **Family vs. individual phone**: Does the family use a WhatsApp group, or
   do we send individual messages? Individual sends are simpler and don't
   require group admin access. This spec assumes individual sends.

4. **Site URL shortening / UTM**: Raw URL for now. Deferred to famcircle#28.
