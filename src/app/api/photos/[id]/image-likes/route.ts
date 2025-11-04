import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

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

    // TODO: Implement like tracking similar to anniversary occurrences
    // For now, return mock response
    return Response.json({
      index: imageIndex,
      count: 0,
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

export const POST = withMemberGuard(postHandler);
