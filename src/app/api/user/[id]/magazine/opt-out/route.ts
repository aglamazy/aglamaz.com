import { withUserGuard } from '@/lib/withUserGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { ListmonkService } from '@/services/ListmonkService';
import type { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  try {
    const user = context.user!;
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) return Response.json({ error: 'Missing siteId' }, { status: 400 });

    const { optOut } = await request.json().catch(() => ({ optOut: true }));
    const repo = new FamilyRepository();

    const member = await repo.getMemberByUserId(user.sub!, siteId);
    if (!member?.email) return Response.json({ error: 'Member not found' }, { status: 404 });

    await repo.setMemberMagazineOptOut(user.sub!, siteId, Boolean(optOut));

    let listmonkSynced = false;
    try {
      listmonkSynced = await ListmonkService.syncMagazineOptOut(member.email, Boolean(optOut));
    } catch (error) {
      // Firestore is the source of truth for the on-site toggle; a Listmonk
      // outage should not block the member from recording their preference.
      console.error('[magazine][opt-out] Listmonk sync failed', error);
    }

    return Response.json({ ok: true, listmonkSynced });
  } catch (error) {
    console.error('magazine opt-out failed', error);
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
};

export const POST = withUserGuard(handler);
