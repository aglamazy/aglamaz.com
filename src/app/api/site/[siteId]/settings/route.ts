import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import { TranslationService } from '@/services/TranslationService';
import nextI18NextConfig from '../../../../../../next-i18next.config.js';

export const dynamic = 'force-dynamic';

const SUPPORTED_LOCALES: string[] = Array.isArray(nextI18NextConfig?.i18n?.locales)
  ? nextI18NextConfig.i18n.locales
  : ['en'];

const putHandler = async (request: Request, context: GuardContext & { params: { siteId: string } }) => {
  try {
    const { siteId } = context.params!;
    const body = await request.json();
    const { aboutFamily, sourceLang } = body;

    if (typeof aboutFamily !== 'string') {
      return Response.json({ error: 'Invalid aboutFamily' }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();
    const siteRef = db.collection('sites').doc(siteId);
    const siteDoc = await siteRef.get();

    if (!siteDoc.exists) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    // Determine source language (default to 'he' if not provided)
    const lang = sourceLang || 'he';

    // Update site with new aboutFamily and clear old translations
    await siteRef.update({
      aboutFamily,
      sourceLang: lang,
      aboutTranslations: {},
      updatedAt: new Date().toISOString(),
    });

    // Trigger translation for all supported locales (if translation service is enabled)
    if (TranslationService.isEnabled() && aboutFamily.trim()) {
      const aboutTranslations: Record<string, string> = {};

      for (const locale of SUPPORTED_LOCALES) {
        // Skip translating to source language
        if (locale === lang) {
          aboutTranslations[locale] = aboutFamily;
          continue;
        }

        try {
          const result = await TranslationService.translateHtml({
            title: '',
            content: aboutFamily,
            from: lang,
            to: locale,
          });
          aboutTranslations[locale] = result.content;
        } catch (error) {
          console.error(`Failed to translate aboutFamily to ${locale}`, error);
          // Fallback to original text
          aboutTranslations[locale] = aboutFamily;
        }
      }

      // Update with all translations
      await siteRef.update({
        aboutTranslations,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Failed to update site settings', error);
    return Response.json({ error: 'Failed to update site settings' }, { status: 500 });
  }
};

const getHandler = async (_request: Request, context: GuardContext & { params: { siteId: string } }) => {
  try {
    const { siteId } = context.params!;

    initAdmin();
    const db = getFirestore();
    const siteDoc = await db.collection('sites').doc(siteId).get();

    if (!siteDoc.exists) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    const data = siteDoc.data();
    return Response.json({
      aboutFamily: data?.aboutFamily || '',
      sourceLang: data?.sourceLang || 'he',
      aboutTranslations: data?.aboutTranslations || {},
    });
  } catch (error) {
    console.error('Failed to get site settings', error);
    return Response.json({ error: 'Failed to get site settings' }, { status: 500 });
  }
};

export const PUT = withAdminGuard(putHandler);
export const GET = withAdminGuard(getHandler);
