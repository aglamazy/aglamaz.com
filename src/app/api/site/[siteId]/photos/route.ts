import { withMemberGuard } from '@/lib/withMemberGuard';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { GuardContext } from '@/app/api/types';
import { extractImageDimensions } from '@/utils/imageDimensions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/site/[siteId]/photos
 * Create a new gallery photo
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = context.user!;
    const body = await request.json();
    const { date, images, videos, description, anniversaryId, locale } = body;

    // Validation
    if (!date) {
      return Response.json({ error: 'Date is required' }, { status: 400 });
    }

    const hasImages = Array.isArray(images) && images.length > 0;
    const hasVideos = Array.isArray(videos) && videos.length > 0;

    if (!hasImages && !hasVideos) {
      return Response.json({ error: 'At least one image or video is required' }, { status: 400 });
    }

    if (!locale || typeof locale !== 'string') {
      return Response.json({ error: 'locale is required' }, { status: 400 });
    }

    // Validate image URLs
    if (hasImages) {
      for (const img of images) {
        if (typeof img !== 'string' || !img.startsWith('https://')) {
          return Response.json({ error: 'Invalid image URL' }, { status: 400 });
        }
      }
    }

    // Validate video URLs
    if (hasVideos) {
      for (const vid of videos) {
        if (typeof vid !== 'string' || !vid.startsWith('https://')) {
          return Response.json({ error: 'Invalid video URL' }, { status: 400 });
        }
      }
    }

    // Extract dimensions for images (skip if no images)
    let imagesWithDimensions: Array<{ url: string; width: number; height: number }> = [];
    if (hasImages) {
      console.log('[photos] Extracting dimensions for', images.length, 'images');
      const dimensions = await extractImageDimensions(images);

      imagesWithDimensions = images.map((url: string, index: number) => {
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
    }

    const repo = new GalleryPhotoRepository();
    const photo = await repo.create({
      siteId,
      createdBy: user.userId,
      date: new Date(date),
      imagesWithDimensions,
      videos: hasVideos ? videos : undefined,
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
 * GET /api/site/[siteId]/photos
 * List all gallery photos for the current site
 */
const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new GalleryPhotoRepository();
    const photos = await repo.listBySite(siteId);
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
