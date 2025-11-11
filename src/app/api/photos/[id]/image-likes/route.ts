import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { ImageLikeRepository } from '@/repositories/ImageLikeRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/photos/[id]/image-likes
 * Get likes for all images in a gallery photo (with first 3 likers for avatar stack)
 */
const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params;
    const member = context.member!;
    const user = context.user!;

    const photoRepo = new GalleryPhotoRepository();
    const photo = await photoRepo.getById(id);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to user's site
    if (photo.siteId !== member.siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch likes for all images (with first 3 likers for avatar stack)
    const likeRepo = new ImageLikeRepository();
    const items = [];

    for (let i = 0; i < photo.images.length; i++) {
      const result = await likeRepo.getLikesForImage(
        id,
        i,
        user.userId,
        member.siteId,
        3 // Only fetch first 3 likers for avatar stack
      );
      items.push(result);
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

    const photoRepo = new GalleryPhotoRepository();
    const photo = await photoRepo.getById(id);

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

    // Toggle like using repository
    const likeRepo = new ImageLikeRepository();
    const result = await likeRepo.toggleLikeForImage(
      id,
      imageIndex,
      user.userId,
      like,
      member.siteId,
      3 // Return first 3 likers for avatar stack
    );

    return Response.json(result);
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
