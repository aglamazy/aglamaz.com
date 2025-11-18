import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';
import { extractImageDimensions } from '@/utils/imageDimensions';

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
    const { date, images, description, anniversaryId, locale } = body;

    // Validation
    if (!date) {
      return Response.json({ error: 'Date is required' }, { status: 400 });
    }

    if (!Array.isArray(images) || images.length === 0) {
      return Response.json({ error: 'At least one image is required' }, { status: 400 });
    }

    if (!locale || typeof locale !== 'string') {
      return Response.json({ error: 'locale is required' }, { status: 400 });
    }

    // Validate image URLs
    for (const img of images) {
      if (typeof img !== 'string' || !img.startsWith('https://')) {
        return Response.json({ error: 'Invalid image URL' }, { status: 400 });
      }
    }

    // Extract dimensions for all images
    console.log('[photos] Extracting dimensions for', images.length, 'images');
    const dimensions = await extractImageDimensions(images);

    // Combine URLs with dimensions
    const imagesWithDimensions = images.map((url, index) => {
      const dim = dimensions[index];
      if (!dim) {
        throw new Error(`Failed to extract dimensions for image at index ${index}`);
      }
      return {
        url,
        width: dim.width,
        height: dim.height
      };
    });

    const repo = new GalleryPhotoRepository();
    const photo = await repo.create({
      siteId: member.siteId,
      createdBy: user.userId,
      date: new Date(date),
      imagesWithDimensions,
      description: description?.trim() || '',
      anniversaryId: anniversaryId || undefined,
      locale,
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
