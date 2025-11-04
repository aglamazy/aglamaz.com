import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/photos
 * Create a new gallery photo
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const body = await request.json();
    const { date, images, description, anniversaryId } = body;

    // Validation
    if (!date) {
      return Response.json({ error: 'Date is required' }, { status: 400 });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return Response.json({ error: 'At least one image is required' }, { status: 400 });
    }

    // Validate image URLs
    for (const img of images) {
      if (typeof img !== 'string' || !img.startsWith('https://')) {
        return Response.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }

    const repo = new GalleryPhotoRepository();
    const photo = await repo.create({
      siteId: member.siteId,
      createdBy: user.userId,
      date: new Date(date),
      images,
      description: description?.trim() || undefined,
      anniversaryId: anniversaryId || undefined,
    });

    return Response.json({ photo }, { status: 201 });
  } catch (error) {
    console.error('[photos] POST error:', error);
    return Response.json(
      { error: 'Failed to create photo' },
      { status: 500 }
    );
  }
};

/**
 * GET /api/photos
 * List all gallery photos for the current site
 */
const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const repo = new GalleryPhotoRepository();
    const photos = await repo.listBySite(member.siteId);
    return Response.json({ photos });
  } catch (error) {
    console.error('[photos] GET error:', error);
    return Response.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
};

export const POST = withMemberGuard(postHandler);
export const GET = withMemberGuard(getHandler);
