/**
 * Utility to get resized image URLs from Firebase Storage
 * Firebase Extension "Resize Images" creates versions with suffixes like _200x200, _400x400, etc.
 */

export enum ImageSize {
  THUMBNAIL = '200x200',
  DESKTOP_GRID = '400x400',
  MOBILE_FEED = '800x800',
  DESKTOP_LIGHTBOX = '1200x1200',
  ORIGINAL = '',
}

/**
 * Convert an image URL to use a specific resized version
 *
 * @param originalUrl - The original Firebase Storage URL
 * @param size - The desired size from ImageSize enum
 * @returns URL with the appropriate size suffix
 *
 * @example
 * getResizedImageUrl('https://.../image.jpg', ImageSize.MOBILE_FEED)
 * // Returns: 'https://.../image_800x800.jpg'
 */
export function getResizedImageUrl(originalUrl: string, size: ImageSize): string {
  if (!originalUrl || size === ImageSize.ORIGINAL) {
    return originalUrl;
  }

  // Find the last dot (file extension)
  const lastDotIndex = originalUrl.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return originalUrl; // No extension found, return as-is
  }

  // Split into base and extension
  const baseName = originalUrl.substring(0, lastDotIndex);
  const extension = originalUrl.substring(lastDotIndex);

  // Append size suffix: image.jpg -> image_800x800.jpg
  return `${baseName}_${size}${extension}`;
}
