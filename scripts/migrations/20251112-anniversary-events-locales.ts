#!/usr/bin/env tsx

/**
 * Migration script: Migrate anniversary event names to locale structure
 *
 * Converts:
 *   { name: "Eti" }
 * To:
 *   {
 *     name: "Eti",  // Keep for backward compatibility
 *     locales: {
 *       he: {
 *         name: "Eti",
 *         name$meta: { source: 'manual', updatedAt: <timestamp> }
 *       }
 *     },
 *     primaryLocale: 'he'
 *   }
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase Admin using environment variables
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

const db = getFirestore();

// Default locale for existing data (assuming Hebrew site)
const DEFAULT_LOCALE = 'he';

async function migrateAnniversaryEvents() {
  console.log('Starting migration of anniversary events...');

  const snapshot = await db.collection('anniversaries').get();
  console.log(`Found ${snapshot.size} anniversary events`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already has locales structure with name
    if (data.locales?.[DEFAULT_LOCALE]?.name) {
      skipped++;
      console.log(`- Skipped ${doc.id} (already migrated)`);
      continue;
    }

    // Skip if no name to migrate
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      skipped++;
      console.log(`- Skipped ${doc.id} (no name)`);
      continue;
    }

    try {
      const updatedAt = data.updatedAt || data.createdAt || Timestamp.now();

      // Migrate name to locales structure
      const update: any = {
        [`locales.${DEFAULT_LOCALE}.name`]: data.name,
        [`locales.${DEFAULT_LOCALE}.name$meta`]: {
          source: 'manual',
          updatedAt: updatedAt
        },
        updatedAt: Timestamp.now()
      };

      // Set primaryLocale if not set
      if (!data.primaryLocale) {
        update.primaryLocale = DEFAULT_LOCALE;
      }

      await doc.ref.update(update);

      migrated++;
      console.log(`✓ Migrated ${doc.id}: "${data.name}"`);
    } catch (error) {
      errors++;
      console.error(`✗ Error migrating ${doc.id}:`, error);
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Total: ${snapshot.size}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

// Run migration
migrateAnniversaryEvents()
  .then(() => {
    console.log('\nMigration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
