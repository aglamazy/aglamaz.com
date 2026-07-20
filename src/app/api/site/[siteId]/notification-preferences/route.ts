import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext) => {
  try {
    const memberId = context.member?.id as string | undefined;
    const siteId = context.member?.siteId;
    if (!memberId || !siteId) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    const preferences = await notificationPreferencesRepository.get(memberId, siteId);
    return Response.json({ preferences });
  } catch (error) {
    console.error('[notification-preferences] failed to load preferences', error);
    return Response.json({ error: 'Failed to load notification preferences' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const memberId = context.member?.id as string | undefined;
    const siteId = context.member?.siteId;
    if (!memberId || !siteId) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Partial<{
      magazineCadence: 'weekly' | 'monthly' | 'none';
      inDayRemindersEnabled: boolean;
    }> = {};

    if (body.magazineCadence === 'weekly' || body.magazineCadence === 'monthly' || body.magazineCadence === 'none') {
      updates.magazineCadence = body.magazineCadence;
    } else if (body.magazineCadence !== undefined) {
      return Response.json({ error: 'Invalid magazineCadence' }, { status: 400 });
    }
    if (typeof body.inDayRemindersEnabled === 'boolean') {
      updates.inDayRemindersEnabled = body.inDayRemindersEnabled;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No updates provided' }, { status: 400 });
    }

    const preferences = await notificationPreferencesRepository.update(memberId, siteId, updates);
    return Response.json({ preferences });
  } catch (error) {
    console.error('[notification-preferences] failed to update preferences', error);
    return Response.json({ error: 'Failed to update notification preferences' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
