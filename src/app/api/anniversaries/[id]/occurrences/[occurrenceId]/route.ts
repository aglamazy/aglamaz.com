import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const { id } = context.params!;
    const occurrenceId = (context.params as any)?.occurrenceId as string;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId!);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Occurrence not found' }, { status: 404 });
    }
    return Response.json({ occurrence: occ });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch occurrence' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const { id } = context.params!;
    const occurrenceId = (context.params as any)?.occurrenceId as string;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId!);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Occurrence not found' }, { status: 404 });
    }
    if (occ.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { date } = body;
    await occRepo.update(occurrenceId!, { date: date ? new Date(date) : undefined });
    const updated = await occRepo.getById(occurrenceId!);
    return Response.json({ occurrence: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update occurrence' }, { status: 500 });
  }
};

const deleteHandler = async (_request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const user = context.user!;
    const { id } = context.params!;
    const occurrenceId = (context.params as any)?.occurrenceId as string;
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(occurrenceId!);
    if (!occ || occ.siteId !== member.siteId || occ.eventId !== id) {
      return Response.json({ error: 'Occurrence not found' }, { status: 404 });
    }
    if (occ.createdBy !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await occRepo.delete(occurrenceId!);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete occurrence' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
