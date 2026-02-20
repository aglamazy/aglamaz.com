/**
 * HEIC/HEIF detection and conversion utilities.
 * heic2any is dynamically imported (~200KB) only when a HEIC file is detected.
 */

const HEIC_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = /\.heic$|\.heif$/i;

export function isHeicFile(file: File): boolean {
  return HEIC_TYPES.includes(file.type) || HEIC_EXTENSIONS.test(file.name);
}

/**
 * If the file is HEIC/HEIF, converts it to JPEG so the browser can decode it.
 * Otherwise returns the original file unchanged.
 */
export async function ensureDecodableImage(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  const heic2any = (await import('heic2any')).default;
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const result = Array.isArray(blob) ? blob[0] : blob;

  const name = file.name.replace(HEIC_EXTENSIONS, '.jpg');
  return new File([result], name, { type: 'image/jpeg' });
}
