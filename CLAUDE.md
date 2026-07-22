@~/.claude/ARCHITECTURE.md
@~/.claude/VERCEL.md
# Claude Development Guidelines

This document contains important guidelines for Claude Code when working on this project.

## Core Principles

### Never Use Fallback Values Without Permission

**CRITICAL**: Never use fallback values or default values in code without explicit user permission.

**Why**: Fallback values mask errors and make debugging difficult. It's better to fail fast with a clear error message than to silently use incorrect values.

**Examples**:

❌ **Bad**:
```typescript
const email = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
const password = process.env.TEST_ADMIN_PASSWORD || 'password';
```

✅ **Good**:
```typescript
if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
  throw new Error(
    'Missing required environment variables:\n' +
    '  TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set.'
  );
}
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
```

**When this applies**:
- Environment variables
- Configuration values
- API endpoints
- Default parameters in functions
- Any value that should be explicitly provided by the user or configuration

**Exception**: Only use fallback values if the user explicitly requests or approves them.

## Architecture Principles

**CRITICAL**: Follow the architecture patterns documented in `docs/architecture.md`:

- **Repository Pattern**: All Firestore database access must go through repository classes
- **Localization in Repositories**: Localization logic belongs in repositories, not API endpoints
- **Localization Storage**: Content stored in `locales.{locale}.{field}` with metadata in `locales.{locale}.{field}$meta`

See `docs/architecture.md` for detailed examples and patterns.

## Landmines

Traps that have actually broken builds/data in this repo — read before baking a task spec.

- **Dev port is 3000, hardcoded in `package.json`'s `dev` script** (`next dev -p 3000`).
  Don't let a global runner silently repin it — `~/develop/docs/ports.txt` registers
  FamCircle at 3000; `run.sh`'s registry matcher was itself buggy until 2026-07-14
  (naive substring match false-positived on other projects' domains).
- **Denormalized calendar fields**: `AnniversaryEvent` stores `date` (Timestamp) AND
  separately `month`/`day`/`year` (numbers, used for querying). Never hand-edit `date`
  alone (e.g. via Firestore console) — the app's own `update()` keeps them in sync, a raw
  edit doesn't, and the calendar filters by `month`/`year`, not `date`.
  (`src/repositories/AnniversaryRepository.ts`)
- **Hebrew-tracked events**: `getEventsForMonth`'s Hebrew branch returns a *display*
  object with `month`/`day`/`year`/`date` overwritten to whatever occurrence is being
  shown for the queried month — NOT the event's true stored date. Any caller that needs
  the real original date (e.g. an edit form) must use `originalDate`/`originalMonth`/
  `originalDay`/`originalYear` instead, or it will silently corrupt the stored date on
  next save. The true original occurrence must always be resolvable independent of the
  lazy `hebrewOccurrences` horizon computation - never make it "on demand only."
- **List endpoints must filter drafts once `status` exists** (famcircle#6 introduces
  `status: 'draft'|'in_review'|'published'` on `IBlogPost`) - every existing list path
  (`getBySite`/`getByAuthor`, public sitemap + blog list routes) needs an implicit
  `status === 'published'` filter (missing `status` = published, for back-compat) or
  drafts/in-review posts leak into public feeds.
- **i18n**: a missing key falls back to the inline `defaultValue` in code (English)
  regardless of active locale - this silently breaks Hebrew's RTL layout (English text
  forced right-to-left). New user-facing strings need entries in ALL THREE locale files
  (`public/locales/{en,he,tr}/common.json`), not just one.
- **Dev-server Fast Refresh mid-test**: editing source files while a browser session has
  an in-progress form open can reset that form's React state via HMR remount, and a
  stale-closure submit handler can silently no-op (no network request, no visible error
  change). If a form submit looks like it did nothing, hard-reload before concluding it's
  a real bug.

## TypeScript Interfaces Reference

**IMPORTANT**: Before working with data structures, always refer to the comprehensive interfaces index:

📋 **[TypeScript Interfaces Index](docs/typescript_interfaces_index.md)** - Complete catalog of 87+ interfaces organized by category:

- **Authentication & User** - TokenClaims, IUser, MemberDoc, MemberRecord
- **Entities** - AnniversaryEvent, Blessing, BlessingPage, BlogPost, Photo, Site
- **API** - GuardContext, RouteParams, request/response types
- **Components** - Props interfaces for all major components
- **Repositories** - Query options, filter options
- **Services** - Localization, configuration, caching

**Usage**: When you need to understand a data structure, check this index first to avoid confusion about property names and types.
