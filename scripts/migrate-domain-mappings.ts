#!/usr/bin/env tsx

/**
 * Migration script: Copy domain_mappings to domainMappings collection
 *
 * This script migrates from snake_case to camelCase collection naming.
 * Run with: npx tsx scripts/migrate-domain-mappings.ts [--dry-run]
 *
 * Safety:
 * - Does NOT delete old collection (kept for rollback)
 * - Skips documents that already exist in new collection
 * - Dry run mode available
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

interface DomainMappingDoc {
  siteId: string;
}

async function migrateDomainMappings(dryRun: boolean = false) {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 Domain Mappings Migration');
  console.log('   From: domain_mappings → To: domainMappings');
  console.log('='.repeat(70));
  console.log();

  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n');
  }

  const db = getFirestore();

  const oldCollection = db.collection('domain_mappings');
  const newCollection = db.collection('domainMappings');

  try {
    // Get all documents from old collection
    const oldSnapshot = await oldCollection.get();

    console.log(`Found ${oldSnapshot.size} documents in 'domain_mappings'\n`);

    if (oldSnapshot.empty) {
      console.log('✅ No documents to migrate.');
      return;
    }

    let copied = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of oldSnapshot.docs) {
      const domain = doc.id;
      const data = doc.data() as DomainMappingDoc;

      console.log(`Processing: ${domain}`);

      // Check if already exists in new collection
      const existingDoc = await newCollection.doc(domain).get();

      if (existingDoc.exists) {
        console.log(`  ⏭️  Already exists in domainMappings - skipping`);
        skipped++;
        continue;
      }

      if (!dryRun) {
        try {
          await newCollection.doc(domain).set(data);
          console.log(`  ✅ Copied successfully`);
          copied++;
        } catch (error) {
          console.error(`  ❌ Error copying: ${error}`);
          errors++;
        }
      } else {
        console.log(`  🧪 Would copy: ${JSON.stringify(data)}`);
        copied++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 Migration Summary');
    console.log('='.repeat(70));
    console.log(`Total documents:     ${oldSnapshot.size}`);
    console.log(`Copied:              ${copied}`);
    console.log(`Skipped (existing):  ${skipped}`);
    console.log(`Errors:              ${errors}`);
    console.log();

    if (dryRun) {
      console.log('🧪 This was a DRY RUN. Run without --dry-run to perform migration.');
    } else if (errors === 0) {
      console.log('✅ Migration completed successfully!');
      console.log();
      console.log('📝 Next steps:');
      console.log('   1. Verify data in Firebase Console (domainMappings collection)');
      console.log('   2. Deploy updated code that uses domainMappings');
      console.log('   3. Monitor production for 24-48 hours');
      console.log('   4. Once stable, delete old domain_mappings collection');
    } else {
      console.log('⚠️  Migration completed with errors. Please review.');
    }

    console.log();

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run migration
migrateDomainMappings(dryRun)
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
