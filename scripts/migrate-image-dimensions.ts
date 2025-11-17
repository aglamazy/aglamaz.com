#!/usr/bin/env tsx

/**
 * Migration script to combine images and imageDimensions into imagesWithDimensions
 *
 * This script:
 * 1. Fetches all documents from galleryPhotos and anniversaryOccurrences
 * 2. Combines images[] and imageDimensions[] into imagesWithDimensions[]
 * 3. Each item becomes {url, width, height}
 * 4. Preserves old fields for backward compatibility during transition
 *
 * Usage: npx tsx scripts/migrate-image-dimensions.ts
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
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const db = getFirestore();

interface ImageDimension {
  width: number;
  height: number;
}

interface ImageWithDimension {
  url: string;
  width: number;
  height: number;
}

/**
 * Combine images and imageDimensions arrays into imagesWithDimensions
 */
function combineImagesWithDimensions(
  images: string[],
  imageDimensions?: (ImageDimension | null)[]
): ImageWithDimension[] | null {
  if (!imageDimensions || imageDimensions.length !== images.length) {
    console.warn('imageDimensions missing or length mismatch');
    return null;
  }

  const combined: ImageWithDimension[] = [];
  for (let i = 0; i < images.length; i++) {
    const dim = imageDimensions[i];
    if (!dim) {
      console.warn(`Missing dimension at index ${i}`);
      return null;
    }
    combined.push({
      url: images[i],
      width: dim.width,
      height: dim.height
    });
  }
  return combined;
}

/**
 * Migrate galleryPhotos collection
 */
async function migrateGalleryPhotos() {
  console.log('\n📸 Migrating galleryPhotos...');

  const snapshot = await db.collection('galleryPhotos')
    .where('deletedAt', '==', null)
    .get();

  console.log(`Found ${snapshot.size} gallery photos`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const images = data.images || [];

    if (images.length === 0) {
      skipped++;
      continue;
    }

    // Check if already has imagesWithDimensions
    if (data.imagesWithDimensions && data.imagesWithDimensions.length === images.length) {
      console.log(`  ✓ Skipping ${doc.id} (already migrated)`);
      skipped++;
      continue;
    }

    console.log(`  Processing ${doc.id} (${images.length} images)...`);

    // Combine images and imageDimensions
    const imagesWithDimensions = combineImagesWithDimensions(images, data.imageDimensions);

    if (!imagesWithDimensions) {
      console.error(`  ✗ Could not combine images and dimensions for ${doc.id}`);
      errors++;
      continue;
    }

    // Update Firestore with combined structure
    try {
      await doc.ref.update({
        imagesWithDimensions,
      });
      processed++;
      console.log(`  ✓ Updated ${doc.id} - combined ${imagesWithDimensions.length} images`);
    } catch (error) {
      console.error(`  ✗ Failed to update ${doc.id}:`, error);
      errors++;
    }
  }

  console.log(`\nGallery Photos: ${processed} processed, ${skipped} skipped, ${errors} errors`);
}

/**
 * Migrate anniversaryOccurrences collection
 */
async function migrateAnniversaryOccurrences() {
  console.log('\n🎉 Migrating anniversaryOccurrences...');

  const snapshot = await db.collection('anniversaryOccurrences').get();

  console.log(`Found ${snapshot.size} anniversary occurrences`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const images = data.images || [];

    if (images.length === 0) {
      skipped++;
      continue;
    }

    // Check if already has imagesWithDimensions
    if (data.imagesWithDimensions && data.imagesWithDimensions.length === images.length) {
      console.log(`  ✓ Skipping ${doc.id} (already migrated)`);
      skipped++;
      continue;
    }

    console.log(`  Processing ${doc.id} (${images.length} images)...`);

    // Combine images and imageDimensions
    const imagesWithDimensions = combineImagesWithDimensions(images, data.imageDimensions);

    if (!imagesWithDimensions) {
      console.error(`  ✗ Could not combine images and dimensions for ${doc.id}`);
      errors++;
      continue;
    }

    // Update Firestore with combined structure
    try {
      await doc.ref.update({
        imagesWithDimensions,
      });
      processed++;
      console.log(`  ✓ Updated ${doc.id} - combined ${imagesWithDimensions.length} images`);
    } catch (error) {
      console.error(`  ✗ Failed to update ${doc.id}:`, error);
      errors++;
    }
  }

  console.log(`\nAnniversary Occurrences: ${processed} processed, ${skipped} skipped, ${errors} errors`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting imagesWithDimensions migration...');
  console.log('This will combine images[] and imageDimensions[] into imagesWithDimensions[]');

  try {
    await migrateGalleryPhotos();
    await migrateAnniversaryOccurrences();

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
