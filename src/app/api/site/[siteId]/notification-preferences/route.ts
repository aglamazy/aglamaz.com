import { withMemberGuard } from '@/lib/withMemberGuard';
import { withReadableGuard } from '@/lib/withReadableGuard';
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

// GET is view-only, so it's safe to allow a signed `rt` read-token in place of a full
// session (docs/family-digest-formats-spec.md §7) - this is the destination the digest
// footer's manage-preferences link (no login) reads from. PUT stays on withMemberGuard:
// any WRITE still requires a real session, per §7's read-token-grants-READ-only rule.
export const GET = withReadableGuard(getHandler);
export const PUT = withMemberGuard(putHandler);
