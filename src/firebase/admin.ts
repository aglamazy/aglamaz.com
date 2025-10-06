import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import nextI18NextConfig from '../../next-i18next.config.js';
import { ConfigRepository } from '@/repositories/ConfigRepository';
import { TranslationService } from '@/services/TranslationService';

export function initAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
      }),
    });
  }
}

export const adminAuth = () => getAuth();

const SUPPORTED_LOCALES: string[] = Array.isArray(nextI18NextConfig?.i18n?.locales)
  ? nextI18NextConfig.i18n.locales
  : ['en'];

async function ensureSiteNameTranslations(siteId: string, siteName?: string | null) {
  if (!siteName) return {} as Record<string, string>;
  const configRepo = new ConfigRepository();
  const stored = await configRepo.getSiteNameTranslations(siteId);
  const translations: Record<string, string> = { ...stored };
  let updated = false;

  for (const locale of SUPPORTED_LOCALES) {
    if (translations[locale]) continue;

    if (!TranslationService.isEnabled()) {
      translations[locale] = siteName;
      updated = true;
      continue;
    }

    try {
      const result = await TranslationService.translateHtml({
        title: siteName,
        content: '',
        to: locale,
        from: undefined,
      });
      const translated = result.title?.trim() || siteName;
      translations[locale] = translated;
      updated = true;
    } catch (error) {
      console.error(`[site] failed to translate site name to ${locale}`, error);
      translations[locale] = siteName;
      updated = true;
    }
  }

  if (!translations.en && siteName) {
    translations.en = siteName;
    updated = true;
  }

  if (updated) {
    await configRepo.setSiteNameTranslations(siteId, translations);
  }

  return translations;
}

export async function fetchSiteInfo() {
  initAdmin();
  const db = getFirestore();
  if (!process.env.NEXT_SITE_ID) {
    throw new Error('NEXT_SITE_ID is not set');
  }
  const siteId = process.env.NEXT_SITE_ID;
  const doc = await db.collection('sites').doc(siteId).get();
  if (!doc.exists) return null;

  const data = doc.data() || {};
  const plainData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      plainData[key] = value.toDate().toISOString();
    } else {
      plainData[key] = value;
    }
  }

  try {
    const translations = await ensureSiteNameTranslations(siteId, plainData.name as string | undefined);
    if (translations && Object.keys(translations).length > 0) {
      plainData.translations = translations;
    }
  } catch (error) {
    console.error('[site] failed to ensure site name translations', error);
  }

  return { id: doc.id, ...plainData };
}
