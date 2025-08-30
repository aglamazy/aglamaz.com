import { withUserGuard } from '@/lib/withUserGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import type { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  try {
    const user = context.user!;
    const url = new URL(request.url);
    const siteId = url.searchParams.get('siteId');
    if (!siteId) return Response.json({ error: 'Missing siteId' }, { status: 400 });
    const { enabled } = await request.json().catch(() => ({ enabled: true }));
    const repo = new FamilyRepository();
    await repo.setMemberBlogEnabled(user.sub!, siteId, Boolean(enabled));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('enable blog failed', error);
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
};

export const POST = withUserGuard(handler);

