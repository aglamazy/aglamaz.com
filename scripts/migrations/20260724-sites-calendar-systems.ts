import { config } from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

// Load environment variables from .env.local
config({ path: '.env.local' });

/**
 * Migration: Backfill calendarSystems / defaultCalendarSystem on all sites
 *
 * Run with: npx tsx scripts/migrations/20260724-sites-calendar-systems.ts
 *
 * Every existing site's event-creation form already offered a Hebrew-calendar
 * checkbox regardless of country, so to preserve that behavior exactly this
 * backfills calendarSystems: ['gregorian', 'jewish'] with defaultCalendarSystem
 * 'gregorian' on any site doc missing the fields - it does not use the
 * country-based heuristic in src/utils/calendarSystems.ts, which is only for
 * NEW sites going forward. Admins can narrow/widen the set afterward in site
 * settings.
 */
async function run() {
  initAdmin();
  const db = getFirestore();
  const collection = db.collection('sites');
  const snapshot = await collection.get();

  console.log(`Found ${snapshot.size} sites to process`);

  let batch = db.batch();
  let ops = 0;
  let processed = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.calendarSystems === undefined || data.defaultCalendarSystem === undefined) {
      batch.update(doc.ref, {
        calendarSystems: ['gregorian', 'jewish'],
        defaultCalendarSystem: 'gregorian',
      });
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
  console.error('Sites calendarSystems migration failed', error);
  process.exit(1);
});
