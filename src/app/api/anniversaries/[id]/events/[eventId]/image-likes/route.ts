import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import { getFirestore } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id, eventId } = params ?? {};
    const resolvedEventId = eventId as string | undefined;
    if (!id || !resolvedEventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(resolvedEventId!);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const images: string[] = Array.isArray((occ as any).images) ? ((occ as any).images as string[]) : [];
    const max = images.length;
    const db = getFirestore();
    const results: Array<{ index: number; count: number; likedByMe: boolean }> = [];
    for (let i = 0; i < max; i++) {
      const likesRef = db
        .collection('anniversaryOccurrences')
        .doc(eventId!)
        .collection('imageLikes')
        .doc(String(i))
        .collection('likes');
      const [snap, mine] = await Promise.all([
        likesRef.get(),
        likesRef.doc(user.userId).get(),
      ]);
      results.push({ index: i, count: snap.size, likedByMe: mine.exists });
    }
    return Response.json({ items: results });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load likes' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id, eventId } = params ?? {};
    const resolvedEventId = eventId as string | undefined;
    if (!id || !resolvedEventId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const body = await request.json();
    const imageIndex = Number(body?.imageIndex);
    const like = Boolean(body?.like);
    if (!Number.isFinite(imageIndex) || imageIndex < 0) {
      return Response.json({ error: 'Invalid image index' }, { status: 400 });
    }
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(resolvedEventId!);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    const imgs: string[] = Array.isArray((occ as any).images) ? ((occ as any).images as string[]) : [];
    if (imageIndex >= imgs.length) {
      return Response.json({ error: 'Index out of range' }, { status: 400 });
    }
    const db = getFirestore();
    const likesRef = db
      .collection('anniversaryOccurrences')
      .doc(resolvedEventId!)
      .collection('imageLikes')
      .doc(String(imageIndex))
      .collection('likes')
      .doc(user.userId);
    if (like) {
      await likesRef.set({ createdAt: new Date() }, { merge: true });
    } else {
      await likesRef.delete();
    }
    const countSnap = await likesRef.parent.get();
    return Response.json({ index: imageIndex, count: countSnap.size, likedByMe: like });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update like' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
