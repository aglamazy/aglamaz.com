import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { SiteRepository, SiteNotFoundError } from '@/repositories/SiteRepository';
import { adminAuth } from '@/firebase/admin';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const { email } = (await request.json()) as { email?: string };
    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    let user;
    try {
      user = await adminAuth().getUserByEmail(email.trim());
    } catch (error) {
      console.error('[admin/owner] failed to find user by email', error);
      return Response.json({ error: 'User not found for this email' }, { status: 404 });
    }

    const repo = new SiteRepository();
    try {
      await repo.updateOwner(siteId, user.uid);
    } catch (error) {
      if (error instanceof SiteNotFoundError) {
        return Response.json({ error: 'Site not found' }, { status: 404 });
      }
      throw error;
    }

    return Response.json({ ownerUid: user.uid, email: user.email || email.trim() });
  } catch (error) {
    console.error('[admin/owner] failed to update owner', error);
    return Response.json({ error: 'Failed to update admin email' }, { status: 500 });
  }
};

export const POST = withAdminGuard(handler);
