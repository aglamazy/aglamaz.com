import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/photos/[id]/image-likes
 * Get all likes for all images in a gallery photo
 */
const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params;
    const member = context.member!;
    const user = context.user!;

    const repo = new GalleryPhotoRepository();
    const photo = await repo.getById(id);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to user's site
    if (photo.siteId !== member.siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch likes for all images
    const db = getFirestore();
    const items: Array<{ index: number; count: number; likedByMe: boolean }> = [];

    for (let i = 0; i < photo.images.length; i++) {
      const likesSnap = await db
        .collection('galleryPhotos')
        .doc(id)
        .collection('imageLikes')
        .doc(String(i))
        .collection('likes')
        .get();

      const likedByMe = likesSnap.docs.some(doc => doc.id === user.userId);

      items.push({
        index: i,
        count: likesSnap.size,
        likedByMe,
      });
    }

    return Response.json({ items });
  } catch (error) {
    console.error('[photos/id/image-likes] GET error:', error);
    return Response.json(
      { error: 'Failed to fetch likes' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/photos/[id]/image-likes
 * Like/unlike a specific image in a gallery photo
 */
const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params;
    const member = context.member!;
    const user = context.user!;
    const body = await request.json();
    const { imageIndex, like } = body;

    if (typeof imageIndex !== 'number' || imageIndex < 0) {
      return Response.json({ error: 'Invalid imageIndex' }, { status: 400 });
    }

    if (typeof like !== 'boolean') {
      return Response.json({ error: 'like must be boolean' }, { status: 400 });
    }

    const repo = new GalleryPhotoRepository();
    const photo = await repo.getById(id);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to user's site
    if (photo.siteId !== member.siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify imageIndex is valid
    if (imageIndex >= photo.images.length) {
      return Response.json({ error: 'Invalid imageIndex' }, { status: 400 });
    }

    // Store likes in subcollection: galleryPhotos/{photoId}/imageLikes/{imageIndex}/likes/{userId}
    const db = getFirestore();
    const likesRef = db
      .collection('galleryPhotos')
      .doc(id)
      .collection('imageLikes')
      .doc(String(imageIndex))
      .collection('likes')
      .doc(user.userId);

    if (like) {
      await likesRef.set({ createdAt: new Date() }, { merge: true });
    } else {
      await likesRef.delete();
    }

    // Count total likes for this image
    const countSnap = await likesRef.parent.get();

    return Response.json({
      index: imageIndex,
      count: countSnap.size,
      likedByMe: like,
    });
  } catch (error) {
    console.error('[photos/id/image-likes] POST error:', error);
    return Response.json(
      { error: 'Failed to update like' },
      { status: 500 }
    );
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
