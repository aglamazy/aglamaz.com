# Locale & Date Formatting Strategy

## 1. Text Language Selection

The app has two distinct areas with different locale resolution strategies.

### Supported Locales

- Supported: `en`, `he`, `tr` (defined in `src/constants/i18n.ts`)
- Default: `he`

### Public Area (`/[locale]/...`)

Public pages are accessible to anyone (anonymous or logged-in). The locale is encoded in the URL path.

- Routes: `/en/blog`, `/he/blog`, `/he/contact`, etc.
- Layout: `src/app/[locale]/layout.tsx`

**Resolution flow:**

1. Locale extracted from URL path (`/he/blog` → `he`)
2. Validated against `SUPPORTED_LOCALES`; invalid values fall back to `he`
3. Passed to `I18nProvider` which initializes i18next
4. To switch language, the user navigates to a different URL (`/en/blog` ↔ `/he/blog`)

### Private Area (`/app/...`, `/admin/...`)

Private pages require authentication. The locale is **not** in the URL — it's resolved server-side from the user's profile.

- Routes: `/app/photo/new`, `/admin/dashboard`, etc.
- Layouts: `src/app/app/layout.tsx`, `src/app/admin/layout.tsx`

**Resolution flow (priority order):**

1. **Query param** `?locale=` (passed via `x-locale` header by middleware in `src/proxy.ts`)
2. **Member's `defaultLocale`** from their profile (`IMember.defaultLocale`)
3. **Accept-Language header** from the browser
4. Falls back to default locale (`he`)

Implementation: `resolveLocaleForPrivateRoutes()` in `src/utils/resolveLocale.ts`

**Key difference:** No URL change needed when switching language. The member's stored preference drives the language automatically.

### Content Localization (Blog Posts, Sites, etc.)

Content stored in Firestore can have multiple translations in `locales.{locale}.{field}`.

Fallback chain when resolving content for display:

1. Preferred locale (from URL or member preference)
2. Explicitly provided fallback locales
3. Content's primary locale
4. Default locale (`he`)
5. Any available locale (last resort)

See `src/utils/blogLocales.ts` for the implementation.

### Summary

| Aspect | Public (`/[locale]/...`) | Private (`/app/...`, `/admin/...`) |
|--------|--------------------------|-------------------------------------|
| Locale source | URL path | Member profile → Accept-Language |
| URL changes for language? | Yes | No |
| Anonymous access? | Yes | No |
| Member preference used? | No | Yes (highest priority after query param) |

## 2. Date Formatting

Date formatting is **separate** from text language. The goal: dates should look natural for the user's region, regardless of which language they're reading in.

### Strategy

| Context | Text language | Date format locale |
|---------|---------------|-------------------|
| **Public area** | URL path (`/he/blog` → `he`) | Timezone (via `tz` cookie) → region, combined with page language |
| **Private area** | Member's `defaultLocale` | Member's `dateLocale` (if set), otherwise timezone → region |

### How Timezone Determines Date Format

The browser's timezone is used to derive the user's region, which determines date formatting conventions.

**Examples:**

| Timezone | Region | Page language | Date locale | Date format |
|----------|--------|---------------|-------------|-------------|
| `Asia/Jerusalem` | IL | `he` | `he-IL` | `15.6.2025` |
| `Asia/Jerusalem` | IL | `en` | `en-IL` | `15/06/2025` |
| `America/New_York` | US | `en` | `en-US` | `6/15/2025` |
| `Europe/London` | GB | `en` | `en-GB` | `15/06/2025` |
| `Europe/Istanbul` | TR | `tr` | `tr-TR` | `15.06.2025` |

### Implementation: Timezone Cookie

The timezone is communicated to the server via a `tz` cookie, enabling fully server-side date rendering.

**Flow:**

1. On first page load, a small client-side script reads `Intl.DateTimeFormat().resolvedOptions().timeZone` and sets a `tz` cookie (e.g., `tz=Asia/Jerusalem`)
2. The cookie is sent automatically with every subsequent request
3. Server reads the `tz` cookie, maps timezone → region code (via `src/utils/timezoneRegion.ts`), and combines it with the page language to form a full date locale
4. Dates are rendered fully server-side using `formatLocalizedDate()` from `src/utils/dateFormat.ts`

**First visit (no cookie yet):** Falls back to the page language without a region (e.g., `he`). For Hebrew and Turkish this produces essentially identical results to the region-specific locale. On the next page load the cookie is available.

### Why Timezone, Not Browser Language?

Browser language settings (`navigator.languages`) are unreliable for date formatting because:

- Users configure languages for **content preference**, not regional formatting
- A user in Israel with Chrome set to "English (UK)" still expects Israeli date conventions
- Timezone is set automatically by the OS and reliably reflects the user's physical location

### User Profile Override (Private Area)

Logged-in users can override the automatic timezone-based date locale in their profile settings. This is stored as `dateLocale` on the member document (e.g., `en-US`, `he-IL`, `en-GB`).

**Resolution order for logged-in users:**

1. Member's `dateLocale` profile field (if set)
2. Timezone cookie → region + page language
3. Page language alone (fallback)

This allows users who travel or have non-standard preferences to set their preferred date format explicitly.
