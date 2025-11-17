import { getStorage } from 'firebase-admin/storage';
import { initAdmin } from '@/firebase/admin';

/**
 * Get a signed download URL for a resized image from Firebase Storage
 *
 * @param originalUrl - The original Firebase Storage URL with token
 * @param size - Size suffix (e.g., '400x400', '800x800', '1200x1200')
 * @returns Signed download URL for the resized image, or original URL if resize doesn't exist
 */
export async function getResizedImageDownloadUrl(
  originalUrl: string,
  size: string
): Promise<string> {
  if (!originalUrl || !size) {
    return originalUrl;
  }

  try {
    initAdmin();
    const storage = getStorage();

    // Extract the file path from the Firebase Storage URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
    const urlObj = new URL(originalUrl);
    const pathEncoded = urlObj.pathname.split('/o/')[1];
    if (!pathEncoded) {
      return originalUrl;
    }

    const filePath = decodeURIComponent(pathEncoded);

    // Build resized file path by inserting size suffix before extension
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return originalUrl;
    }

    const basePath = filePath.substring(0, lastDotIndex);
    const extension = filePath.substring(lastDotIndex);
    const resizedPath = `${basePath}_${size}${extension}`;

    // Get the file from storage
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable not set');
    }
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(resizedPath);

    // Check if resized file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[FirebaseStorageService] Resized image not found: ${resizedPath}, falling back to original`);
      return originalUrl;
    }

    // Get signed download URL (valid for 1 hour)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return url;
  } catch (error) {
    console.error('[FirebaseStorageService] Error getting resized image URL:', error);
    return originalUrl; // Fallback to original
  }
}

/**
 * Get download URLs for multiple sizes of an image
 *
 * @param originalUrl - The original Firebase Storage URL
 * @param sizes - Array of size suffixes (e.g., ['400x400', '800x800'])
 * @returns Object mapping sizes to download URLs
 */
export async function getMultipleResizedUrls(
  originalUrl: string,
  sizes: string[]
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};

  await Promise.all(
    sizes.map(async (size) => {
      urls[size] = await getResizedImageDownloadUrl(originalUrl, size);
    })
  );

  return urls;
}
