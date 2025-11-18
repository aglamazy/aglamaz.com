import { config } from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Migration: Add deletedAt field to all anniversary events
 *
 * Run with: npx tsx scripts/migrations/20250404-anniversaries-add-deletedAt.ts
 *
 * This sets deletedAt: null on all anniversary documents that don't already have the field,
 * so soft-delete filters (deletedAt == null) include existing events.
 */
async function run() {
  initAdmin();
  const db = getFirestore();
  const collection = db.collection('anniversaries');
  const snapshot = await collection.get();

  console.log(`Found ${snapshot.size} anniversary events to process`);

  let batch = db.batch();
  let ops = 0;
  let processed = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.deletedAt === undefined) {
      batch.update(doc.ref, { deletedAt: null });
      ops += 1;
      updated += 1;
    }
    processed += 1;

    if (ops >= 450) {
      await batch.commit();
      console.log(`Committed batch. Processed ${processed}/${snapshot.size}, updated ${updated}`);
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Migration complete. Processed ${processed} docs, updated ${updated}.`);
}

run().catch((error) => {
  console.error('Anniversaries deletedAt migration failed', error);
  process.exit(1);
});
