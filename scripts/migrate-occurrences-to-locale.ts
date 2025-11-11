#!/usr/bin/env tsx

/**
 * Migration script: Migrate anniversary occurrence descriptions to locale structure
 *
 * Converts:
 *   { description: "תיאור בעברית" }
 * To:
 *   {
 *     description: "תיאור בעברית",  // Keep for backward compatibility
 *     locales: {
 *       he: {
 *         description: "תיאור בעברית",
 *         description$meta: { source: 'manual', updatedAt: <timestamp> }
 *       }
 *     }
 *   }
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Initialize Firebase Admin using environment variables (same as src/firebase/admin.ts)
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

async function migrateAnniversaryOccurrences() {
  console.log('Starting migration of anniversary occurrences...');

  const snapshot = await db.collection('anniversaryOccurrences').get();
  console.log(`Found ${snapshot.size} anniversary occurrences`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already has locales.he.description
    if (data.locales?.he?.description) {
      skipped++;
      continue;
    }

    // Skip if no description to migrate
    if (!data.description || typeof data.description !== 'string' || data.description.trim() === '') {
      skipped++;
      continue;
    }

    try {
      const updatedAt = data.updatedAt || data.createdAt || Timestamp.now();

      // Migrate description to locales.he.description
      await doc.ref.update({
        'locales.he.description': data.description,
        'locales.he.description$meta': {
          source: 'manual',
          updatedAt: updatedAt
        },
        updatedAt: Timestamp.now()
      });

      migrated++;
      console.log(`✓ Migrated ${doc.id}`);
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
migrateAnniversaryOccurrences()
  .then(() => {
    console.log('\nMigration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration failed:', error);
    process.exit(1);
  });
