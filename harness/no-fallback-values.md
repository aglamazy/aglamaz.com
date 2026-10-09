# Never use fallback values without permission

Restored 2026-10-07 from `9c86906^:CLAUDE.md` lines 9-43, verbatim below the heading.
Commit 9c86906 (famcircle#174, 2026-09-14) index-shaped CLAUDE.md from 129 lines to 53 by
moving each rule's detail into `harness/<file>.md` - but this file was never created, so
CLAUDE.md's first Core Principle pointed at nothing for three weeks and the detail existed
only in git history. CLAUDE.md also calls it "shared with the parent \`Aglamaz\` project
(see \`../harness/no-fallback-values.md\`, same content)"; no such parent file or parent
CLAUDE.md exists, so that cross-reference is still unresolved and is NOT fixed here.

No rule changed. The one-line statement in CLAUDE.md was always operative; this is the
detail it promised.

---

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
