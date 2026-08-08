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

- **Any `create()`-adjacent repository method must default closed/private, never
  published/public, when the caller omits the option** — don't rely on a downstream
  back-compat helper (like `isPublished()`'s "missing status = published") to cover for
  an omission at write time; that back-compat rule exists for legacy data, not as a
  license to skip setting the field going forward. Origin: `BlogRepository.create()`
  never set `status` at all, so a freshly-created AI-drafted post (general#10, the
  Shofar blog-candidate pipeline) was readable as published the instant it was created —
  before `requestReview()` ever ran — because `isPublished()` treated the missing field
  as published. Fixed by adding an explicit `status` param; any new create()-shaped
  method (posts, or anything else with a draft/review gate) needs the same explicit
  default, not an implicit one.

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
