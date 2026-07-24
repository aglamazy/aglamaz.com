import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { SiteRepository, SiteNotFoundError } from '@/repositories/SiteRepository';
import nextI18NextConfig from '../../../../../../next-i18next.config.js';
import { isCalendarSystem, normalizeCalendarSystems, type CalendarSystem } from '@/utils/calendarSystems';

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
    if (typeof sourceLang !== 'string' || !sourceLang.trim()) {
      return Response.json({ error: 'Invalid sourceLang' }, { status: 400 });
    }

    const repository = new SiteRepository();
    if (calendarSystems !== undefined || defaultCalendarSystem !== undefined) {
      if (!Array.isArray(calendarSystems) || !isCalendarSystem(defaultCalendarSystem)) {
        return Response.json({ error: 'Invalid calendar system settings' }, { status: 400 });
      }
      const normalizedCalendarSystems = normalizeCalendarSystems(calendarSystems) as CalendarSystem[];
      if (normalizedCalendarSystems.length === 0) {
        return Response.json({ error: 'Invalid calendar system settings' }, { status: 400 });
      }
      if (!normalizedCalendarSystems.includes(defaultCalendarSystem)) {
        return Response.json({ error: 'Invalid calendar system settings' }, { status: 400 });
      }

      try {
        await repository.updateAbout({
          siteId,
          aboutFamily,
          sourceLang: sourceLang.trim(),
          supportedLocales: SUPPORTED_LOCALES,
          calendarSystems: normalizedCalendarSystems,
          defaultCalendarSystem,
        });
      } catch (error) {
        if (error instanceof SiteNotFoundError) {
          return Response.json({ error: 'Site not found' }, { status: 404 });
        }
        throw error;
      }

      return Response.json({ ok: true });
    }

    try {
      await repository.updateAbout({
        siteId,
        aboutFamily,
        sourceLang: sourceLang.trim(),
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
