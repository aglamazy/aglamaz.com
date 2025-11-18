import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { ImageLikeRepository } from '@/repositories/ImageLikeRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/site/[siteId]/photos/[photoId]/image-likes
 * Get likes for all images in a gallery photo (with first 3 likers for avatar stack)
 */
const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; photoId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const photoId = params?.photoId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!photoId) {
      return Response.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = context.member!;
    const user = context.user!;

    const photoRepo = new GalleryPhotoRepository();
    const photo = await photoRepo.getById(photoId);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to this site
    if (photo.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch likes for all images (with first 3 likers for avatar stack)
    const likeRepo = new ImageLikeRepository();
    const items = [];

    for (let i = 0; i < photo.imagesWithDimensions.length; i++) {
      const result = await likeRepo.getLikesForImage(
        photoId,
        i,
        user.userId,
        member.siteId,
        3 // Only fetch first 3 likers for avatar stack
      );
      items.push(result);
    }

    return Response.json({ items });
  } catch (error) {
    console.error('[photos/photoId/image-likes] GET error:', error);
    return Response.json(
      { error: 'Failed to fetch likes' },
      { status: 500 }
    );
  }
};

/**
 * POST /api/site/[siteId]/photos/[photoId]/image-likes
 * Like/unlike a specific image in a gallery photo
 */
const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; photoId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const photoId = params?.photoId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!photoId) {
      return Response.json({ error: 'Photo ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    const photo = await photoRepo.getById(photoId);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to this site
    if (photo.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify imageIndex is valid
    if (imageIndex >= photo.imagesWithDimensions.length) {
      return Response.json({ error: 'Invalid imageIndex' }, { status: 400 });
    }

    // Toggle like using repository
    const likeRepo = new ImageLikeRepository();
    const result = await likeRepo.toggleLikeForImage(
      photoId,
      imageIndex,
      user.userId,
      like,
      member.siteId,
      3 // Return first 3 likers for avatar stack
    );

    return Response.json(result);
  } catch (error) {
    console.error('[photos/photoId/image-likes] POST error:', error);
    return Response.json(
      { error: 'Failed to update like' },
      { status: 500 }
    );
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
