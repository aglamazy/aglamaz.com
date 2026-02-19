/**
 * Server-side image processing and Firebase Storage upload
 *
 * Uses sharp for resize/conversion and Firebase Admin SDK for storage upload.
 * Produces URLs compatible with FirebaseStorageService.getResizedImageDownloadUrl().
 */

import sharp from 'sharp';
import crypto from 'crypto';
import { getStorage } from 'firebase-admin/storage';
import { initAdmin } from '@/firebase/admin';

export interface ProcessedImage {
  url: string;
  width: number;
  height: number;
}

/**
 * Resize an image buffer to WebP format and upload to Firebase Storage.
 *
 * @param buffer - Raw image data
 * @param storagePath - Destination path in Firebase Storage (e.g. "anniversaries/{uid}/events/{id}/photo.webp")
 * @param maxWidth - Maximum width in pixels (default 1600)
 * @param quality - WebP quality 1-100 (default 90)
 * @returns URL, width, and height of the uploaded image
 */
export async function processAndUploadImage(
  buffer: Buffer,
  storagePath: string,
  maxWidth = 1600,
  quality = 90,
): Promise<ProcessedImage> {
  // Resize and convert to WebP
  const processed = await sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });

  const { data, info } = processed;

  // Upload to Firebase Storage
  initAdmin();
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable not set');
  }

  const bucket = getStorage().bucket(bucketName);
  const file = bucket.file(storagePath);
  const downloadToken = crypto.randomUUID();

  await file.save(data, {
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  // Construct Firebase Storage download URL
  const encodedPath = encodeURIComponent(storagePath);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;

  return {
    url,
    width: info.width,
    height: info.height,
  };
}
