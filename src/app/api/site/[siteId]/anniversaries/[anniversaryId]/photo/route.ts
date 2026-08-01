// Server-side proxy for an anniversary event's existing photo, so the browser-side
// crop tool (EventFormContent.tsx:handleEditExistingPhoto) can read the image bytes
// into a <canvas> without a cross-origin `fetch()` straight to Firebase Storage. An
// <img src=...> tag loads fine cross-origin regardless of CORS, but a programmatic
// fetch() of the same URL does not - Firebase Storage's bucket isn't CORS-configured
// for this origin, so that direct fetch fails in every real browser (confirmed live,
// Agla 2026-08-01: "can't edit a photo. And the crop scrollbar doesn't show" - the
// fetch threw, landing in handleEditExistingPhoto's catch). Fetching server-side has
// no CORS restriction (CORS is a browser-enforced policy only), so proxying through
// our own origin sidesteps it entirely.
import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (
  _request: Request,
  context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> },
) => {
  const params = await context.params;
  const siteId = params?.siteId;
  const anniversaryId = params?.anniversaryId;

  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!anniversaryId) {
    return Response.json({ error: 'Anniversary ID is required' }, { status: 400 });
  }

  const repo = new AnniversaryRepository();
  const event = await repo.getById(anniversaryId);
  if (!event || event.siteId !== siteId) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }
  if (!event.imageUrl) {
    return Response.json({ error: 'Event has no photo' }, { status: 404 });
  }

  try {
    const upstream = await fetch(event.imageUrl);
    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: 'Failed to load photo' }, { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'image/jpeg',
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[anniversaries/photo] proxy fetch failed', error);
    return Response.json({ error: 'Failed to load photo' }, { status: 502 });
  }
};

export const GET = withMemberGuard(getHandler);
