import { MagazineTemplateRepository } from '@/repositories/MagazineTemplateRepository';
import { withMemberGuard } from '@/lib/withMemberGuard';
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/site/[siteId]/magazine-template
 * Fetches the site's current monthly-magazine HTML template (if any).
 */
const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repository = new MagazineTemplateRepository();
    const template = await repository.get(siteId);

    return Response.json({ template });
  } catch (error) {
    console.error('[magazine-template] GET error:', error);
    return Response.json({ error: 'Failed to fetch magazine template' }, { status: 500 });
  }
};

/**
 * POST /api/site/[siteId]/magazine-template
 * Saves the platform editor's authored HTML template (requires admin role).
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const html = body?.html;

    if (typeof html !== 'string' || !html.trim()) {
      return Response.json({ error: 'html is required' }, { status: 400 });
    }

    const repository = new MagazineTemplateRepository();
    const template = await repository.save(siteId, html, 'manual');

    return Response.json({ template });
  } catch (error) {
    console.error('[magazine-template] POST error:', error);
    return Response.json({ error: 'Failed to save magazine template' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withAdminGuard(postHandler);
