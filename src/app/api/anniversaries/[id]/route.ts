import { withMemberGuard } from '@/lib/withMemberGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (typeof value._seconds === 'number') {
    return new Date(value._seconds * 1000);
  }
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const repo = new AnniversaryRepository();
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};
    const existing = await repo.getById(id!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    return Response.json({ event: existing });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};
    const existing = await repo.getById(id!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { name, description, type, date, isAnnual, imageUrl, useHebrew, deathDate, burialDate } = body;
    const parsedDate = date ? new Date(date) : undefined;
    if (date && parsedDate && Number.isNaN(parsedDate.getTime())) {
      return Response.json({ error: 'Invalid date' }, { status: 400 });
    }
    const parsedDeathDate = deathDate ? new Date(deathDate) : undefined;
    if (deathDate && parsedDeathDate && Number.isNaN(parsedDeathDate.getTime())) {
      return Response.json({ error: 'Invalid death date' }, { status: 400 });
    }
    const parsedBurialDate = burialDate ? new Date(burialDate) : undefined;
    if (burialDate && parsedBurialDate && Number.isNaN(parsedBurialDate.getTime())) {
      return Response.json({ error: 'Invalid burial date' }, { status: 400 });
    }
    const finalType = (type ?? existing.type) as string;
    const willUseHebrew = useHebrew !== undefined ? useHebrew : existing.useHebrew;
    const deathForValidation =
      parsedDeathDate ?? parsedDate ?? toDate(existing.deathDate) ?? toDate(existing.date);
    const isDeathType = finalType === 'death' || finalType === 'death_anniversary';
    if (willUseHebrew && isDeathType) {
      if (!deathForValidation) {
        return Response.json({ error: 'Invalid death date' }, { status: 400 });
      }
      const burialForValidation = parsedBurialDate ?? toDate(existing.burialDate);
      if (!burialForValidation) {
        return Response.json({ error: 'Invalid burial date' }, { status: 400 });
      }
      if (burialForValidation.getTime() < deathForValidation.getTime()) {
        return Response.json({ error: 'Burial date must not precede death date' }, { status: 400 });
      }
    }
    await repo.update(id!, {
      name,
      description,
      type,
      date: parsedDate,
      deathDate: parsedDeathDate,
      burialDate: parsedBurialDate,
      isAnnual: isAnnual !== undefined ? Boolean(isAnnual) : undefined,
      imageUrl,
      useHebrew,
    });
      const updated = await repo.getById(id!);
    return Response.json({ event: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new AnniversaryRepository();
    const member = context.member!;
    const user = context.user!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};
    const existing = await repo.getById(id!);
    if (!existing || existing.siteId !== member.siteId) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }
    if (existing.ownerId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.delete(id!);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
};

export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
export const GET = withMemberGuard(getHandler);
