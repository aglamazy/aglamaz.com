import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';
import { buildLocalizedUpdate } from '@/services/LocalizationService';
import { Timestamp, getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/photos/[id]
 * Get a single gallery photo
 */
const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params;
    const repo = new GalleryPhotoRepository();
    const photo = await repo.getById(id);

    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Verify photo belongs to user's site
    const member = context.member!;
    if (photo.siteId !== member.siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    return Response.json({ photo });
  } catch (error) {
    console.error('[photos/id] GET error:', error);
    return Response.json(
      { error: 'Failed to fetch photo' },
      { status: 500 }
    );
  }
};

/**
 * PUT /api/photos/[id]
 * Update a gallery photo with localization support
 */
const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params;
    const member = context.member!;
    const user = context.user!;
    const body = await request.json();
    const { date, description, locale } = body;

    if (!locale || typeof locale !== 'string') {
      return Response.json({ error: 'locale is required' }, { status: 400 });
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

    // Only creator or admin can edit
    if (photo.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build updates object with localization
    const db = getFirestore();
    const docRef = db.collection('galleryPhotos').doc(id);
    const updates: any = {};

    // Update date if provided
    if (date !== undefined) {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return Response.json({ error: 'Invalid date' }, { status: 400 });
      }
      updates.date = Timestamp.fromDate(dateObj);
    }

    // Update description with localization
    if (description !== undefined) {
      const localizedUpdates = buildLocalizedUpdate(
        photo,
        locale,
        { description: description?.trim() || '' },
        'manual',
        Timestamp.now()
      );
      Object.assign(updates, localizedUpdates);
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = Timestamp.now();
      await docRef.update(updates);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[photos/id] PUT error:', error);
    return Response.json(
      { error: 'Failed to update photo' },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/photos/[id]
 * Soft delete a gallery photo (sets deletedAt timestamp, doesn't remove from database)
 */
const deleteHandler = async (request: Request, context: GuardContext & { params: Promise<{ id: string }> }) => {
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

    // Only creator or admin can delete
    if (photo.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SOFT DELETE: Sets deletedAt = Timestamp.now(), photo remains in database
    // Use repo.hardDelete(id) if you need to actually remove the document
    await repo.delete(id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[photos/id] DELETE error:', error);
    return Response.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    );
  }
};

export const GET = withMemberGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
