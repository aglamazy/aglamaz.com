import sharp from 'sharp';
import * as https from 'https';
import * as http from 'http';

export interface ImageDimension {
  width: number;
  height: number;
}

/**
 * Download image from URL and extract dimensions using sharp
 */
async function getImageDimensionsFromUrl(url: string): Promise<ImageDimension | null> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;

    client.get(url, (response) => {
      const chunks: Buffer[] = [];

      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const metadata = await sharp(buffer).metadata();

          if (metadata.width && metadata.height) {
            resolve({ width: metadata.width, height: metadata.height });
          } else {
            console.error('[imageDimensions] Could not extract dimensions from image');
            resolve(null);
          }
        } catch (error) {
          console.error('[imageDimensions] Error processing image:', error);
          resolve(null);
        }
      });

      response.on('error', (error) => {
        console.error('[imageDimensions] Error downloading image:', error);
        resolve(null);
      });
    });
  });
}

/**
 * Extract dimensions from multiple image URLs
 * Uses original images since we only need aspect ratio for CLS prevention
 *
 * @param imageUrls - Array of Firebase Storage image URLs
 * @returns Array of ImageDimension objects (or null if extraction failed)
 */
export async function extractImageDimensions(
  imageUrls: string[]
): Promise<(ImageDimension | null)[]> {
  const dimensions: (ImageDimension | null)[] = [];

  for (const imageUrl of imageUrls) {
    try {
      // Use original image - we only need aspect ratio, not exact dimensions
      const dim = await getImageDimensionsFromUrl(imageUrl);
      dimensions.push(dim);

      if (dim) {
        console.log(`[imageDimensions] Extracted dimensions: ${dim.width}x${dim.height}`);
      } else {
        console.warn(`[imageDimensions] Could not extract dimensions from ${imageUrl}`);
      }
    } catch (error) {
      console.error(`[imageDimensions] Error processing ${imageUrl}:`, error);
      dimensions.push(null);
    }
  }

  return dimensions;
}
