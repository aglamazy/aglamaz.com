import { withMemberGuard } from '@/lib/withMemberGuard';
import { ImageLikeRepository, ImageLikesResult } from '@/repositories/ImageLikeRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

interface LikesRequestItem {
  id: string;
  type: 'gallery' | 'occurrence';
  imageCount: number;
}

/**
 * POST /api/site/[siteId]/pictures/likes
 * Batch-fetch likes for multiple items in a single request.
 * Body: { items: [{ id, type, imageCount }] }
 * Returns: { likes: Record<string, ImageLikesResult[]> }
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = context.user!;
    const body = await request.json();
    const requestItems: LikesRequestItem[] = body.items;

    if (!Array.isArray(requestItems) || requestItems.length === 0) {
      return Response.json({ error: 'items array is required' }, { status: 400 });
    }

    const likeRepo = new ImageLikeRepository();
    const likes: Record<string, ImageLikesResult[]> = {};

    await Promise.all(
      requestItems.map(async (item) => {
        if (!item.id || !item.type || typeof item.imageCount !== 'number') return;
        try {
          const perImage = await Promise.all(
            Array.from({ length: item.imageCount }, (_, idx) =>
              item.type === 'gallery'
                ? likeRepo.getLikesForImage(item.id, idx, user.userId, siteId, 3)
                : likeRepo.getLikesForOccurrenceImage(item.id, idx, user.userId, siteId, 3)
            )
          );
          likes[item.id] = perImage;
        } catch (err) {
          console.error(`[pictures/likes] fetch failed for ${item.id}:`, err);
        }
      })
    );

    return Response.json({ likes });
  } catch (error) {
    console.error('[pictures/likes] POST error:', error);
    return Response.json({ error: 'Failed to fetch likes' }, { status: 500 });
  }
};

export const POST = withMemberGuard(postHandler);
