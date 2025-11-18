import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/site/[siteId]/photos/[photoId]
 * Get a single gallery photo
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

    const repo = new GalleryPhotoRepository();
    const photo = await repo.getById(photoId);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to this site
    if (photo.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    return Response.json({ photo });
  } catch (error) {
    console.error('[photos/photoId] GET error:', error);
    return Response.json(
      { error: 'Failed to fetch photo' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/site/[siteId]/photos/[photoId]
 * Update a gallery photo with localization support
 */
const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; photoId: string }> }) => {
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
    const { date, description, locale } = body;

    if (!locale || typeof locale !== 'string') {
      return Response.json({ error: 'locale is required' }, { status: 400 });
    }

    const repo = new GalleryPhotoRepository();
    const photo = await repo.getById(photoId);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to this site
    if (photo.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only creator or admin can edit
    if (photo.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate date if provided
    if (date !== undefined) {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return Response.json({ error: 'Invalid date' }, { status: 400 });
      }
    }

    // Update photo using repository (handles localization)
    await repo.update(photoId, {
      date: date !== undefined ? new Date(date) : undefined,
      description: description !== undefined ? description?.trim() || '' : undefined,
      locale,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[photos/photoId] PUT error:', error);
    return Response.json(
      { error: 'Failed to update photo' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/site/[siteId]/photos/[photoId]
 * Soft delete a gallery photo (sets deletedAt timestamp, doesn't remove from database)
 */
const deleteHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; photoId: string }> }) => {
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

    const repo = new GalleryPhotoRepository();
    const photo = await repo.getById(photoId);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to this site
    if (photo.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only creator or admin can delete
    if (photo.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SOFT DELETE: Sets deletedAt = Timestamp.now(), photo remains in database
    // Use repo.hardDelete(photoId) if you need to actually remove the document
    await repo.delete(photoId);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[photos/photoId] DELETE error:', error);
    return Response.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    );
  }
};

export const GET = withMemberGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
