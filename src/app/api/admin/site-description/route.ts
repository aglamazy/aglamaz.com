import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/auth/service';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { revalidateTag } from 'next/cache';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';
import { TranslationService } from '@/services/TranslationService';
import { normalizeLang } from '@/services/LocalizationService';
import type { ISite } from '@/entities/Site';
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

    initAdmin();
    const db = getFirestore();
    const siteRef = db.collection('sites').doc(siteId);
    const doc = await siteRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const site = doc.data() as ISite;
    const sourceLang = site.sourceLang || 'en';
    const normalizedSource = normalizeLang(sourceLang) || sourceLang;

    if (
      requestedLocale &&
      requestedLocale !== normalizedSource &&
      site.name
    ) {
      const translations = site.translations || {};
      const existingTranslation = translations[requestedLocale];
      const needsTranslation = !existingTranslation || !existingTranslation.name;

      if (needsTranslation) {
        if (!TranslationService.isEnabled()) {
          return NextResponse.json(
            { error: 'Translation service disabled' },
            { status: 503 }
          );
        }

        const now = Timestamp.now();
        const translatedName = await TranslationService.translateHtml({
          title: site.name || '',
          content: '',
          from: sourceLang,
          to: requestedLocale,
        });

        const updatedTranslation = {
          ...(existingTranslation || {
            name: '',
            aboutFamily: '',
            platformName: '',
            translatedAt: now,
            engine: 'gpt' as const,
          }),
          name: translatedName.title || site.name,
          translatedAt: now,
          engine: 'gpt' as const,
        };

        const translationMeta = site.translationMeta || {};
        const requestedMap = { ...(translationMeta.requested || {}) };
        requestedMap[requestedLocale] = now;

        await siteRef.update({
          [`translations.${requestedLocale}`]: updatedTranslation,
          translationMeta: {
            ...translationMeta,
            requested: requestedMap,
          },
          updatedAt: now,
        });

        revalidateTag(`site-${siteId}`);

        site.translations = {
          ...translations,
          [requestedLocale]: updatedTranslation,
        };
        site.translationMeta = {
          ...translationMeta,
          requested: requestedMap,
        };
      }
    }

    return NextResponse.json({
      site: {
        id: doc.id,
        name: site.name,
        aboutFamily: site.aboutFamily || '',
        platformName: site.platformName || '',
        sourceLang: site.sourceLang || 'en',
        translations: site.translations || {},
      },
    });
  } catch (error) {
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

    initAdmin();
    const db = getFirestore();

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

    // Get current site data
    const siteDoc = await db.collection('sites').doc(siteId).get();
    if (!siteDoc.exists) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    const currentSite = siteDoc.data() as ISite;
    const sourceLang = currentSite.sourceLang || 'en';

    // Prepare update
    const updates: Partial<ISite> = {
      updatedAt: Timestamp.now() as any,
    };

    // If editing source language, update base fields
    if (normalizedLocale === sourceLang) {
      if (name !== undefined) updates.name = name;
      if (aboutFamily !== undefined) updates.aboutFamily = aboutFamily;
      if (platformName !== undefined) updates.platformName = platformName;
    } else {
      // If editing a translation, update translations map
      const translations = currentSite.translations || {};
      const existingTranslation = translations[normalizedLocale] || {
        name: '',
        aboutFamily: '',
        platformName: '',
        translatedAt: Timestamp.now() as any,
        engine: 'manual' as const,
      };

      const updatedTranslation = {
        ...existingTranslation,
        name: name !== undefined ? name : existingTranslation.name,
        aboutFamily: aboutFamily !== undefined ? aboutFamily : existingTranslation.aboutFamily,
        platformName: platformName !== undefined ? platformName : existingTranslation.platformName,
        translatedAt: Timestamp.now() as any,
        engine: 'manual' as const,
      };

      updates.translations = {
        ...translations,
        [normalizedLocale]: updatedTranslation,
      };
    }

    // Handle auto-translation requests
    if (requestTranslations && TranslationService.isEnabled()) {
      const translationMeta = currentSite.translationMeta || { requested: {}, attempts: 0 };
      const translations = currentSite.translations || {};

      for (const targetLocale of SUPPORTED_LOCALES) {
        if (targetLocale === sourceLang) continue;
        if (translations[targetLocale]) continue; // Skip if translation exists

        // Mark as requested
        translationMeta.requested = translationMeta.requested || {};
        translationMeta.requested[targetLocale] = Timestamp.now() as any;

        // Queue background translation
        (async () => {
          try {
            console.log('[site-translation] start', { siteId, to: targetLocale });

            // Translate each field separately
            const translatedName = await TranslationService.translateHtml({
              title: currentSite.name,
              content: '',
              from: sourceLang,
              to: targetLocale,
            });

            const translatedAbout = currentSite.aboutFamily
              ? await TranslationService.translateHtml({
                  title: '',
                  content: currentSite.aboutFamily,
                  from: sourceLang,
                  to: targetLocale,
                })
              : { title: '', content: '' };

            const translatedPlatform = currentSite.platformName
              ? await TranslationService.translateHtml({
                  title: currentSite.platformName,
                  content: '',
                  from: sourceLang,
                  to: targetLocale,
                })
              : { title: '', content: '' };

            // Save translation
            const siteRef = db.collection('sites').doc(siteId);
            await siteRef.update({
              [`translations.${targetLocale}`]: {
                name: translatedName.title,
                aboutFamily: translatedAbout.content,
                platformName: translatedPlatform.title,
                translatedAt: Timestamp.now(),
                engine: 'gpt',
              },
            });

            console.log('[site-translation] complete', { siteId, to: targetLocale });
          } catch (err) {
            console.error(`Background site translation failed for ${siteId} to ${targetLocale}:`, err);
          }
        })();
      }

      updates.translationMeta = translationMeta;
    }

    // Update site document
    await db.collection('sites').doc(siteId).update(updates);

    // Revalidate cache
    revalidateTag(`site-${siteId}`);

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
