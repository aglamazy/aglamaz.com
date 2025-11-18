import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { SiteRepository, SiteNotFoundError, TranslationDisabledError } from '@/repositories/SiteRepository';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';
import { normalizeLang } from '@/services/LocalizationService';
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';

const SUPPORTED_LOCALES = CONFIG_LOCALES.map((locale) => locale as string);

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/site-description
 * Fetches the current site info for the admin to edit
 */
export async function GET(request: NextRequest) {
  try {
    const requestedLocaleRaw = request.nextUrl.searchParams.get('locale');
    const requestedLocale = normalizeLang(requestedLocaleRaw);

    const token = request.cookies.get(ACCESS_TOKEN)?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = process.env.NEXT_SITE_ID;
    if (!siteId) {
      return NextResponse.json({ error: 'Site ID not configured' }, { status: 500 });
    }

    const repository = new SiteRepository();
    const site = await repository.get(siteId, requestedLocale);

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get most recent locale for each field (to determine "source" locale for backwards compatibility)
    const { getMostRecentFieldVersion } = await import('@/services/LocalizationService');
    const nameSource = getMostRecentFieldVersion(site, 'name');

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        aboutFamily: site.aboutFamily || '',
        platformName: site.platformName || '',
        locales: site.locales || {}, // Include all locales
      },
    });
  } catch (error) {
    if (error instanceof TranslationDisabledError) {
      return NextResponse.json(
        { error: 'Translation service disabled' },
        { status: 503 }
      );
    }
    console.error('[site-description] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site info' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/site-description
 * Saves site information with translations (requires admin role)
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const siteId = context.member?.siteId || process.env.NEXT_SITE_ID;

    if (!siteId) {
      return Response.json({ error: 'Site ID not configured' }, { status: 500 });
    }

    // Parse request body
    const body = await request.json();
    const { locale, name, aboutFamily, platformName, requestTranslations } = body;

    if (!locale) {
      return Response.json({ error: 'locale is required' }, { status: 400 });
    }

    const normalizedLocale = normalizeLang(locale);
    if (!normalizedLocale) {
      return Response.json({ error: 'Invalid locale' }, { status: 400 });
    }

    const repository = new SiteRepository();
    try {
      await repository.updateSiteContent({
        siteId,
        locale: normalizedLocale,
        name,
        aboutFamily,
        platformName,
        requestTranslations: Boolean(requestTranslations),
        supportedLocales: SUPPORTED_LOCALES,
      });
    } catch (error) {
      if (error instanceof SiteNotFoundError) {
        return Response.json({ error: 'Site not found' }, { status: 404 });
      }
      throw error;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[site-description] POST error:', error);
    return Response.json(
      { error: 'Failed to save site info' },
      { status: 500 }
    );
  }
};

export const POST = withAdminGuard(postHandler);
