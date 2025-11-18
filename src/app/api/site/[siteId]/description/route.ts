import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { SiteRepository, SiteNotFoundError, TranslationDisabledError } from '@/repositories/SiteRepository';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';
import { normalizeLang } from '@/services/LocalizationService';
import { withAdminGuard } from '@/lib/withAdminGuard';
import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';

const SUPPORTED_LOCALES = CONFIG_LOCALES.map((locale) => locale as string);

export const dynamic = 'force-dynamic';

/**
 * GET /api/site/[siteId]/description
 * Fetches the current site info (available to all members of that site)
 */
const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const url = new URL(request.url);
    const requestedLocaleRaw = url.searchParams.get('locale');
    const requestedLocale = normalizeLang(requestedLocaleRaw);

    const params = context.params instanceof Promise ? await context.params : context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repository = new SiteRepository();
    const site = await repository.get(siteId, requestedLocale);

    if (!site) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    return Response.json({
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
      return Response.json(
        { error: 'Translation service disabled' },
        { status: 503 }
      );
    }
    console.error('[site-description] GET error:', error);
    return Response.json(
      { error: 'Failed to fetch site info' },
      { status: 500 }
    );
  }
};

export const GET = withMemberGuard(getHandler);

/**
 * POST /api/site/[siteId]/description
 * Saves site information with translations (requires admin role)
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify admin has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
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
