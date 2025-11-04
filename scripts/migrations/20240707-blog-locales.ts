      import { config } from 'dotenv';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

// Load environment variables from .env.local
config({ path: '.env.local' });

interface LegacyTranslation {
  title?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  translatedAt?: any;
  engine?: string;
}

function normalizeLocale(locale: string | undefined): string {
  return (locale || 'en').toLowerCase();
}

function buildMeta(options: { engine?: string; sourceLocale: string; updatedAt: any }) {
  return {
    engine: (options.engine as any) ?? 'other',
    sourceLocale: normalizeLocale(options.sourceLocale),
    updatedAt: options.updatedAt ?? Timestamp.now(),
  };
}

async function run() {
  initAdmin();
  const db = getFirestore();
  const collection = db.collection('blogPosts');
  const snapshot = await collection.get();

  console.log(`Found ${snapshot.size} blog posts to inspect`);

  let batch = db.batch();
  let ops = 0;
  let processed = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already migrated
    if (data._migrated === true) {
      console.log(`Skipping ${doc.id} - already migrated`);
      skipped += 1;
      processed += 1;
      continue;
    }

    const locales: Record<string, any> = {};
    const hasLocales = data.locales && Object.keys(data.locales || {}).length > 0;
    const sourceLocale = normalizeLocale(data.primaryLocale || data.sourceLang || 'en');

    if (!hasLocales) {
      const baseMeta = buildMeta({ engine: 'manual', sourceLocale, updatedAt: data.updatedAt || data.createdAt || Timestamp.now() });
      const baseEntry: Record<string, any> = {};
      if (data.title !== undefined) {
        baseEntry.title = data.title;
        baseEntry.title$meta = baseMeta;
      }
      if (data.content !== undefined) {
        baseEntry.content = data.content;
        baseEntry.content$meta = baseMeta;
      }
      if (data.seoTitle !== undefined) {
        baseEntry.seoTitle = data.seoTitle;
        baseEntry.seoTitle$meta = baseMeta;
      }
      if (data.seoDescription !== undefined) {
        baseEntry.seoDescription = data.seoDescription;
        baseEntry.seoDescription$meta = baseMeta;
      }
      if (Object.keys(baseEntry).length > 0) {
        locales[sourceLocale] = baseEntry;
      }

      const translations = (data.translations || {}) as Record<string, LegacyTranslation>;
      for (const [localeKey, value] of Object.entries(translations)) {
        const normalized = normalizeLocale(localeKey);
        const meta = buildMeta({
          engine: value?.engine || 'other',
          sourceLocale,
          updatedAt: value?.translatedAt || data.updatedAt || data.createdAt || Timestamp.now(),
        });
        const entry: Record<string, any> = {};
        if (value?.title !== undefined) {
          entry.title = value.title;
          entry.title$meta = meta;
        }
        if (value?.content !== undefined) {
          entry.content = value.content;
          entry.content$meta = meta;
        }
        if (value?.seoTitle !== undefined) {
          entry.seoTitle = value.seoTitle;
          entry.seoTitle$meta = meta;
        }
        if (value?.seoDescription !== undefined) {
          entry.seoDescription = value.seoDescription;
          entry.seoDescription$meta = meta;
        }
        locales[normalized] = entry;
      }
    }

    const update: Record<string, any> = {};
    if (!hasLocales && Object.keys(locales).length > 0) {
      update.locales = locales;
    }

    const finalPrimary = hasLocales
      ? normalizeLocale(data.primaryLocale || Object.keys(data.locales || {})[0] || sourceLocale)
      : sourceLocale;
    if (!data.primaryLocale || normalizeLocale(data.primaryLocale) !== finalPrimary) {
      update.primaryLocale = finalPrimary;
    }

    // Mark as migrated instead of deleting old fields
    update._migrated = true;

    // Keep old fields for safety - don't delete them
    // if (data.sourceLang !== undefined) {
    //   update.sourceLang = FieldValue.delete();
    // }
    // if (data.translations !== undefined) {
    //   update.translations = FieldValue.delete();
    // }
    // if (data.title !== undefined) {
    //   update.title = FieldValue.delete();
    // }
    // if (data.content !== undefined) {
    //   update.content = FieldValue.delete();
    // }
    // if (data.seoTitle !== undefined) {
    //   update.seoTitle = FieldValue.delete();
    // }
    // if (data.seoDescription !== undefined) {
    //   update.seoDescription = FieldValue.delete();
    // }

    if (Object.keys(update).length === 0) {
      processed += 1;
      continue;
    }

    batch.set(doc.ref, update, { merge: true });
    ops += 1;
    processed += 1;

    if (ops >= 450) {
      await batch.commit();
      console.log(`Committed batch. Processed ${processed}/${snapshot.size} (${skipped} skipped)`);
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Migration complete. Processed ${processed} documents (${skipped} already migrated, ${processed - skipped} updated).`);
}

run().catch((error) => {
  console.error('Blog locales migration failed', error);
  process.exit(1);
});

