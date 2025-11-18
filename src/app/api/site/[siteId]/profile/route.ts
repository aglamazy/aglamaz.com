import { withUserGuard } from '@/lib/withUserGuard';
import { GuardContext } from '@/app/api/types';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { SUPPORTED_LOCALES } from '@/i18n';

export const dynamic = 'force-dynamic';

const getHandler = async (_request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = new FamilyRepository();
    const member = await repo.getMemberByUserId(userId, siteId);
    if (!member) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    return Response.json({ member });
  } catch (error) {
    console.error('[site/profile] failed to load member profile', error);
    return Response.json({ error: 'Failed to load member profile' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }
    const userId = context.user?.sub;
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const repo = new FamilyRepository();
    const resolved = await repo.getMemberByUserId(userId, siteId);
    if (!resolved) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, string> = {};

    if (typeof body.displayName === 'string') {
      const displayName = body.displayName.trim();
      if (!displayName) {
        return Response.json({ error: 'Display name is required' }, { status: 400 });
      }
      updates.displayName = displayName;
    }

    if (typeof body.defaultLocale === 'string') {
      const locale = body.defaultLocale.trim();
      if (locale && SUPPORTED_LOCALES.includes(locale)) {
        updates.defaultLocale = locale;
      } else if (locale) {
        return Response.json({ error: 'Invalid locale' }, { status: 400 });
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No updates provided' }, { status: 400 });
    }

    await repo.updateMember(resolved.id, updates);
    const updated = await repo.getMemberById(resolved.id);
    return Response.json({ member: updated });
  } catch (error) {
    console.error('[site/profile] failed to update member profile', error);
    return Response.json({ error: 'Failed to update member profile' }, { status: 500 });
  }
};

export const GET = withUserGuard(getHandler);
export const PUT = withUserGuard(putHandler);
