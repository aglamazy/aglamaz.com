import { withUserGuard } from '@/lib/withUserGuard';
import { GuardContext } from '@/app/api/types';
import { MemberRepository } from '@/repositories/MemberRepository';
import { NotificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import { ListmonkService } from '@/services/ListmonkService';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    if (!siteId) return Response.json({ error: 'Missing siteId' }, { status: 400 });
    const userId = context.user?.sub;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const memberRepo = new MemberRepository();
    const member = await memberRepo.getByUid(siteId, userId);
    if (!member) return Response.json({ error: 'Member not found' }, { status: 404 });

    const prefsRepo = new NotificationPreferencesRepository();
    const prefs = await prefsRepo.get(member.id);

    return Response.json({
      prefs: { magazineOptOut: prefs?.magazineOptOut ?? false },
    });
  } catch (error) {
    console.error('[notification-prefs] GET error:', error);
    return Response.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    if (!siteId) return Response.json({ error: 'Missing siteId' }, { status: 400 });
    const userId = context.user?.sub;
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const memberRepo = new MemberRepository();
    const member = await memberRepo.getByUid(siteId, userId);
    if (!member) return Response.json({ error: 'Member not found' }, { status: 404 });

    const body = await request.json();
    if (typeof body.magazineOptOut !== 'boolean') {
      return Response.json({ error: 'magazineOptOut must be a boolean' }, { status: 400 });
    }

    const prefsRepo = new NotificationPreferencesRepository();
    await prefsRepo.setMagazineOptOut(member.id, siteId, body.magazineOptOut);

    try {
      const listmonk = new ListmonkService();
      if (body.magazineOptOut) {
        await listmonk.unsubscribeFromMagazine(member.email);
      } else {
        const name = member.displayName || member.firstName || member.email;
        await listmonk.subscribeToMagazine(member.email, name);
      }
    } catch (err) {
      console.error('[notification-prefs] Listmonk sync failed (non-fatal):', err);
    }

    return Response.json({ prefs: { magazineOptOut: body.magazineOptOut } });
  } catch (error) {
    console.error('[notification-prefs] PUT error:', error);
    return Response.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
};

export const GET = withUserGuard(getHandler);
export const PUT = withUserGuard(putHandler);
