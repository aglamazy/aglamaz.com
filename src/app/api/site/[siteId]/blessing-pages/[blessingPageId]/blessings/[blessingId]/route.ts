import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlessingRepository } from '@/repositories/BlessingRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const user = context.user!;
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { blessingId } = params ?? {};
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify blessing exists
    const blessingRepo = new BlessingRepository();
    const existing = await blessingRepo.getById(blessingId!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Blessing not found' }, { status: 404 });
    }

    // Only author or admin can edit
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get locale from header
    const locale = request.headers.get('x-locale') || 'he';

    // Update blessing
    await blessingRepo.update(blessingId!, { content, locale });

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update blessing' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext) => {
  try {
    const user = context.user!;
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { blessingId } = params ?? {};

    // Verify blessing exists
    const blessingRepo = new BlessingRepository();
    const existing = await blessingRepo.getById(blessingId!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Blessing not found' }, { status: 404 });
    }

    // Only author or admin can delete
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete
    await blessingRepo.softDelete(blessingId!);

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete blessing' }, { status: 500 });
  }
};

export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
