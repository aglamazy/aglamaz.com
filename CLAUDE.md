@~/.claude/ARCHITECTURE.md
@~/.claude/VERCEL.md

# Claude Development Guidelines

Index-shaped 2026-09-14 (famcircle#174) — one line per rule; full detail lives in
`harness/<file>.md`. Read the linked file before touching that area, not before.

## Core Principles

- **Never use fallback values without permission** — fail fast with a clear error
  instead of silently defaulting; exception only on explicit user approval. →
  `harness/no-fallback-values.md` (shared with the parent `Aglamaz` project — see
  `../harness/no-fallback-values.md`, same content).

## Architecture Principles

- **Repository Pattern**: all Firestore access goes through repository classes.
  **Localization** logic belongs in repositories, not API endpoints, stored as
  `locales.{locale}.{field}` with metadata in `locales.{locale}.{field}$meta`. →
  `docs/architecture.md`

## TypeScript Interfaces Reference

- **87+ interfaces catalogued** (auth/user, entities, API, components, repositories,
  services) — check before working with a data structure to avoid property-name/type
  confusion. → `docs/typescript_interfaces_index.md`

## Landmines

Traps that have actually broken builds/data in this repo — read the linked section
before baking a task spec that touches that area. → `harness/landmines.md`

- **Dev port hardcoded to 3000** in `package.json`'s `dev` script — don't let a global
  runner silently repin it. → `harness/landmines.md#dev-port`
- **Denormalized calendar fields** (`AnniversaryEvent.date` vs `month`/`day`/`year`) —
  never hand-edit `date` alone. → `harness/landmines.md#calendar-fields`
- **Hebrew-tracked events' display object overwrites date fields** — use
  `originalDate`/`originalMonth`/`originalDay`/`originalYear` for the true stored date.
  → `harness/landmines.md#hebrew-events`
- **List endpoints must filter drafts** once `status` exists on `IBlogPost`. →
  `harness/landmines.md#draft-filter`
- **i18n**: a missing key silently falls back to English, breaking Hebrew RTL — all 4
  locale files (`en`/`he`/`tr`/`ar`) need every new string. →
  `harness/landmines.md#i18n`
- **Dev-server Fast Refresh mid-test** can silently reset an in-progress form's React
  state via HMR remount. → `harness/landmines.md#fast-refresh`
- **Firestore `.set(obj, {merge:true})` does NOT nest dotted-string keys** — only
  `.update(obj)` does; use `LocalizationService` rather than hand-rolling. →
  `harness/landmines.md#dotted-keys`
- **Never `fetch()` a Firebase Storage URL from the browser** — no CORS; proxy through
  a same-origin API route for raw bytes client-side. →
  `harness/landmines.md#storage-cors`
