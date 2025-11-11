# Architecture Guidelines

## Repository Pattern

All Firestore database access must go through repository classes located in `src/repositories/`.

**Rules**:
- API routes must NOT directly access `getFirestore()` or Firestore collections
- All database operations go through repository methods
- Repositories encapsulate data access logic and provide clean interfaces
- Migration scripts should also use repositories

**Example**:
```typescript
// ❌ Bad: Direct Firestore access in API
const db = getFirestore();
const doc = await db.collection('members').doc(id).get();

// ✅ Good: Using repository
const memberRepo = new MemberRepository();
const member = await memberRepo.getById(id, siteId);
```

## Localization

### Storage Format

Localizable content is stored in the `locales` object:

```typescript
{
  locales: {
    he: {
      description: "תיאור בעברית",
      description$meta: {
        source: 'manual',  // 'manual' | 'gpt' | 'other'
        updatedAt: Timestamp
      }
    },
    en: {
      description: "English description",
      description$meta: {
        source: 'gpt',
        updatedAt: Timestamp
      }
    }
  }
}
```

### Implementation Pattern

**Localization logic belongs in repositories, not API endpoints.**

1. Entity extends `LocalizableDocument` interface
2. Repository method accepts optional `locale` parameter
3. Repository calls `ensureLocale()` and `getLocalizedFields()` internally
4. API endpoint just passes locale to repository

**Example**:

```typescript
// In repository
async listBySite(siteId: string, locale?: string): Promise<Item[]> {
  const db = this.getDb();
  const items = await this.fetchFromFirestore(siteId);

  if (locale) {
    const { ensureLocale, getLocalizedFields } = await import('@/services/LocalizationService');
    return Promise.all(
      items.map(async (item) => {
        const docRef = db.collection(this.collection).doc(item.id);
        const ensured = await ensureLocale(item, docRef, locale, ['description']);
        const localized = getLocalizedFields(ensured, locale, ['description']);
        return { ...ensured, description: localized.description };
      })
    );
  }

  return items;
}

// In API route
const repo = new ItemRepository();
const items = await repo.listBySite(siteId, locale);
```

### JIT Translation

When content doesn't exist in the requested locale, `ensureLocale()`:
1. Finds the most recent version of the field (any locale)
2. Translates it to the requested locale using TranslationService
3. Saves the translation to Firestore
4. Returns the updated document

This means translations happen automatically on first access and are cached for future requests.
