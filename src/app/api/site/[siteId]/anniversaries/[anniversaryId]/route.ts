import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { sendHonoreeInvite } from '@/services/HonoreeInviteService';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!anniversaryId) {
      return Response.json({ error: 'Anniversary ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new AnniversaryRepository();
    const existing = await repo.getById(anniversaryId);

    if (!existing || existing.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Lazily ensure occurrence 0 exists for this event
    const occRepo = new AnniversaryOccurrenceRepository();
    const originalOccurrence = await occRepo.ensureOriginalOccurrence(existing, existing.ownerId);

    // Fetch blessing pages for this event
    const blessingPageRepo = new BlessingPageRepository();
    const blessingPages = await blessingPageRepo.listByEvent(anniversaryId, existing.type);

    return Response.json({
      event: {
        ...existing,
        originalOccurrenceId: originalOccurrence.id,
        blessingPages: blessingPages.map(bp => ({ year: bp.year, slug: bp.slug }))
      }
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!anniversaryId) {
      return Response.json({ error: 'Anniversary ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;

    const existing = await repo.getById(anniversaryId);
    if (!existing || existing.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl, useHebrew, honoreeMemberId, honoreeEmail, sendInviteNow } = body;

    // Get locale from header (injected by proxy from query param)
    const locale = request.headers.get('x-locale') || 'he';

    await repo.update(anniversaryId, {
      name,
      description,
      type,
      date: date ? new Date(date) : undefined,
      isAnnual: isAnnual !== undefined ? Boolean(isAnnual) : undefined,
      imageUrl,
      useHebrew,
      locale,
      honoreeMemberId: honoreeMemberId !== undefined ? (honoreeMemberId || null) : undefined,
      honoreeEmail: honoreeMemberId ? null : (honoreeEmail !== undefined ? (honoreeEmail || null) : undefined),
    });
    const updated = await repo.getById(anniversaryId);

    // Best-effort - a failed invite send must not fail the event save itself.
    if (updated && !honoreeMemberId && honoreeEmail && sendInviteNow) {
      try {
        await sendHonoreeInvite({
          siteId,
          event: updated,
          honoreeEmail,
          authorName: (member as any).firstName || (member as any).displayName || user.email || '',
          authorId: user.userId,
          authorEmail: (member as any).email || user.email,
        });
      } catch (inviteError) {
        console.error('[anniversaries] failed to send honoree invite', inviteError);
      }
    }

    return Response.json({ event: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; anniversaryId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const anniversaryId = params?.anniversaryId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!anniversaryId) {
      return Response.json({ error: 'Anniversary ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;

    const existing = await repo.getById(anniversaryId);
    if (!existing || existing.siteId !== siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.delete(anniversaryId);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
export const GET = withMemberGuard(getHandler);
