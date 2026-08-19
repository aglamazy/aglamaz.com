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
    const { aboutFamily, sourceLang, defaultLocale, calendarSystems, defaultCalendarSystem } = body;

    if (typeof aboutFamily !== 'string') {
      return Response.json({ error: 'Invalid aboutFamily' }, { status: 400 });
    }
    if (defaultLocale !== undefined && !SUPPORTED_LOCALES.includes(defaultLocale)) {
      return Response.json({ error: 'Invalid defaultLocale' }, { status: 400 });
    }

    let normalizedCalendarSystems: CalendarSystem[] | undefined;
    if (calendarSystems !== undefined || defaultCalendarSystem !== undefined) {
      if (!Array.isArray(calendarSystems) || !isCalendarSystem(defaultCalendarSystem)) {
        return Response.json({ error: 'Invalid calendar system settings' }, { status: 400 });
      }
      normalizedCalendarSystems = normalizeCalendarSystems(calendarSystems);
      if (normalizedCalendarSystems.length === 0 || !normalizedCalendarSystems.includes(defaultCalendarSystem)) {
        return Response.json({ error: 'Invalid calendar system settings' }, { status: 400 });
      }
    }

    const repository = new SiteRepository();
    const lang = sourceLang || 'he';

    try {
      await repository.updateAbout({
        siteId,
        aboutFamily,
        sourceLang: lang,
        supportedLocales: SUPPORTED_LOCALES,
        ...(normalizedCalendarSystems ? { calendarSystems: normalizedCalendarSystems, defaultCalendarSystem } : {}),
      });
      if (defaultLocale !== undefined) {
        await repository.updateDefaultLocale(siteId, defaultLocale);
      }
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
