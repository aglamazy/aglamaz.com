import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { SiteRepository, SiteNotFoundError, InvalidCalendarSystemsError } from '@/repositories/SiteRepository';
import type { CalendarSystem } from '@/entities/Site';
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
    const { aboutFamily, sourceLang, calendarSystems, defaultCalendarSystem } = body;

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

      if (calendarSystems !== undefined || defaultCalendarSystem !== undefined) {
        if (
          !Array.isArray(calendarSystems) ||
          !calendarSystems.every((c) => typeof c === 'string') ||
          typeof defaultCalendarSystem !== 'string'
        ) {
          return Response.json({ error: 'Invalid calendar system config' }, { status: 400 });
        }
        await repository.updateCalendarSystems({
          siteId,
          calendarSystems: calendarSystems as CalendarSystem[],
          defaultCalendarSystem: defaultCalendarSystem as CalendarSystem,
        });
      }
    } catch (error) {
      if (error instanceof SiteNotFoundError) {
        return Response.json({ error: 'Site not found' }, { status: 404 });
      }
      if (error instanceof InvalidCalendarSystemsError) {
        return Response.json({ error: error.message }, { status: 400 });
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
