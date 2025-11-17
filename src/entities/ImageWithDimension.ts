/**
 * Image entity that stores URL and dimensions together
 * Used to prevent Cumulative Layout Shift (CLS) by providing dimensions before image loads
 */
export interface ImageWithDimension {
  url: string;
  width: number;
  height: number;
}

/**
 * Validate that an object is a valid ImageWithDimension
 */
export function isImageWithDimension(obj: any): obj is ImageWithDimension {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.url === 'string' &&
    typeof obj.width === 'number' &&
    typeof obj.height === 'number' &&
    obj.width > 0 &&
    obj.height > 0
  );
}

/**
 * Validate an array of ImageWithDimension objects
 */
export function validateImagesWithDimensions(images: any[]): images is ImageWithDimension[] {
  if (!Array.isArray(images)) {
    return false;
  }
  return images.every(isImageWithDimension);
}
