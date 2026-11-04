import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { ImageLikeRepository } from '@/repositories/ImageLikeRepository';
import { fetchOccurrenceLikes } from '@/services/ImageLikesQuery';

export const dynamic = 'force-dynamic';

/**
 * GET /api/site/[siteId]/anniversaries/[anniversaryId]/events/[eventId]/image-likes
 * Likes (with first 3 likers for the avatar stack) for the images named in `?indexes=0,1,2`,
 * returned as { byIndex: { [imageIndex]: likes } }. Without `indexes`: every image, as
 * { items: [...] } in image order (famcircle#199 keeps that for un-updated callers).
 */
const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string; eventId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;
    const eventId = params?.eventId;

    if (!siteId || !anniversaryId || !eventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = context.member!;
    const user = context.user!;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(eventId);
    if (!occ || occ.siteId !== siteId || occ.eventId !== anniversaryId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const imagesWithDimensions = occ.imagesWithDimensions || [];

    // Only the images the caller names (famcircle#199): one Firestore read per index.
    // No `indexes` param = every image, as before, for a caller not yet updated.
    const outcome = await fetchOccurrenceLikes(
      new ImageLikeRepository(),
      eventId,
      imagesWithDimensions.length,
      new URL(request.url).searchParams.get('indexes'),
      user.userId,
      member.siteId,
    );
    if ('error' in outcome) {
      return Response.json({ error: outcome.error }, { status: 400 });
    }
    return Response.json(outcome.body);
  } catch (error) {
    console.error('[anniversaries/anniversaryId/events/eventId/image-likes] GET error:', error);
    return Response.json({ error: 'Failed to load likes' }, { status: 500 });
  }
};

/**
 * POST /api/site/[siteId]/anniversaries/[anniversaryId]/events/[eventId]/image-likes
 * Like/unlike a specific image in an anniversary occurrence
 */
const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string; eventId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;
    const eventId = params?.eventId;

    if (!siteId || !anniversaryId || !eventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
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

    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(eventId);
    if (!occ || occ.siteId !== siteId || occ.eventId !== anniversaryId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const imagesWithDimensions = occ.imagesWithDimensions || [];

    // Verify imageIndex is valid
    if (imageIndex >= imagesWithDimensions.length) {
      return Response.json({ error: 'Invalid imageIndex' }, { status: 400 });
    }

    // Toggle like using repository
    const likeRepo = new ImageLikeRepository();
    const result = await likeRepo.toggleLikeForOccurrenceImage(
      eventId,
      imageIndex,
      user.userId,
      like,
      member.siteId,
      3 // Return first 3 likers for avatar stack
    );

    return Response.json(result);
  } catch (error) {
    console.error('[anniversaries/anniversaryId/events/eventId/image-likes] POST error:', error);
    return Response.json({ error: 'Failed to update like' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
