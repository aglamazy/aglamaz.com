import { initFirebase, auth, ensureFirebaseSignedIn } from '@/firebase/client';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ensureDecodableImage } from '@/utils/heicConvert';

export class ImageStore {
  /**
   * Resize and convert image to WebP format
   */
  static async resizeToWebp(file: File, maxWidth = 1600, quality = 0.9): Promise<Blob> {
    file = await ensureDecodableImage(file);
    const img = document.createElement('img');
    img.decoding = 'async';
    img.src = URL.createObjectURL(file);
    await img.decode();
    const ratio = img.width > 0 ? Math.min(1, maxWidth / img.width) : 1;
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/webp', quality)
    );
    URL.revokeObjectURL(img.src);
    return blob;
  }

  /**
   * Crop image to specified dimensions
   */
  static cropImage(
    img: HTMLImageElement,
    containerWidth: number,
    containerHeight: number,
    offsetY: number
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const scale = img.naturalWidth / containerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = containerWidth;
      canvas.height = containerHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(
        img,
        0,
        offsetY * scale,
        containerWidth * scale,
        containerHeight * scale,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }
        const fileName = 'cropped.jpg';
        const croppedFile = new File([blob], fileName, { type: 'image/jpeg' });
        resolve(croppedFile);
      }, 'image/jpeg');
    });
  }

  /**
   * Upload image to Firebase Storage
   */
  static async uploadImage(file: File, path: string): Promise<string> {
    initFirebase();
    await ensureFirebaseSignedIn();

    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Not signed in to Firebase');
    }

    const storage = getStorage();
    const storageRef = ref(storage, `${path}/${currentUser.uid}/${Date.now()}_${file.name}`);

    await uploadBytes(storageRef, file, {
      cacheControl: 'public, max-age=31536000, immutable',
    });

    return await getDownloadURL(storageRef);
  }

  /**
   * Upload anniversary event image
   */
  static async uploadAnniversaryImage(file: File): Promise<string> {
    return this.uploadImage(file, 'anniversaries');
  }

  /**
   * Upload gallery photo (resize to WebP first)
   */
  static async uploadGalleryPhoto(file: File, maxWidth = 1600, quality = 0.9): Promise<string> {
    initFirebase();
    await ensureFirebaseSignedIn();

    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('Not signed in to Firebase');
    }

    const blob = await this.resizeToWebp(file, maxWidth, quality);
    const fileName = `${Date.now()}.webp`;
    const storage = getStorage();
    const storageRef = ref(storage, `gallery/${currentUser.uid}/${fileName}`);

    await uploadBytes(storageRef, blob, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    return await getDownloadURL(storageRef);
  }
}
