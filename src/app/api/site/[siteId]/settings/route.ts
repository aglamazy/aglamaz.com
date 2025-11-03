import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { SiteRepository, SiteNotFoundError } from '@/repositories/SiteRepository';
import nextI18NextConfig from '../../../../../../next-i18next.config.js';

export const dynamic = 'force-dynamic';

const SUPPORTED_LOCALES: string[] = Array.isArray(nextI18NextConfig?.i18n?.locales)
  ? nextI18NextConfig.i18n.locales
  : ['en'];

const resolveParams = async (context: GuardContext) =>
  (context.params instanceof Promise ? await context.params : context.params) ?? {};

const putHandler = async (request: Request, context: GuardContext & { params: { siteId: string } }) => {
  try {
    const { siteId } = await resolveParams(context);
    const body = await request.json();
    const { aboutFamily, sourceLang } = body;

    if (typeof aboutFamily !== 'string') {
      return Response.json({ error: 'Invalid aboutFamily' }, { status: 400 });
    }

    const repository = new SiteRepository();
    const lang = sourceLang || 'he';

    try {
      await repository.updateAbout({
        siteId,
        aboutFamily,
        sourceLang: lang,
        supportedLocales: SUPPORTED_LOCALES,
      });
    } catch (error) {
      if (error instanceof SiteNotFoundError) {
        return Response.json({ error: 'Site not found' }, { status: 404 });
      }
      throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Failed to update site settings', error);
    return Response.json({ error: 'Failed to update site settings' }, { status: 500 });
  }
};

const getHandler = async (_request: Request, context: GuardContext & { params: { siteId: string } }) => {
  try {
    const { siteId } = await resolveParams(context);

    const repository = new SiteRepository();
    try {
      const settings = await repository.getSettings(siteId);
      return Response.json(settings);
    } catch (error) {
      if (error instanceof SiteNotFoundError) {
        return Response.json({ error: 'Site not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Failed to get site settings', error);
    return Response.json({ error: 'Failed to get site settings' }, { status: 500 });
  }
};

export const PUT = withAdminGuard(putHandler);
export const GET = withAdminGuard(getHandler);
