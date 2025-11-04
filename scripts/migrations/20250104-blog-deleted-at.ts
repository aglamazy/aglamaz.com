import { config } from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Migration: Add deletedAt field to all blog posts
 *
 * Run with: npx tsx scripts/migrations/20250104-blog-deleted-at.ts
 *
 * This adds deletedAt: null to all existing blog posts that don't have the field.
 * Required before deploying soft delete feature to prevent existing posts from being filtered out.
 */
async function run() {
  initAdmin();
  const db = getFirestore();
  const collection = db.collection('blogPosts');
  const snapshot = await collection.get();

  console.log(`Found ${snapshot.size} blog posts to process`);

  let batch = db.batch();
  let ops = 0;
  let processed = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Only update if deletedAt field doesn't exist
    if (data.deletedAt === undefined) {
      batch.update(doc.ref, { deletedAt: null });
      ops += 1;
      updated += 1;
    }

    processed += 1;

    // Commit batch every 450 operations (Firestore limit is 500)
    if (ops >= 450) {
      await batch.commit();
      console.log(`Committed batch. Processed ${processed}/${snapshot.size}, updated ${updated}`);
      batch = db.batch();
      ops = 0;
    }
  }

  // Commit remaining operations
  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Migration complete. Processed ${processed} documents, updated ${updated} with deletedAt: null.`);
}

run().catch((error) => {
  console.error('Blog deletedAt migration failed', error);
  process.exit(1);
});
