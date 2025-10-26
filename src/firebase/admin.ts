import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
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

/**
 * Internal function to fetch site info from Firebase (without caching).
 * Use fetchSiteInfo() instead, which includes caching.
 */
async function _fetchSiteInfoUncached(siteId: string) {
  initAdmin();
  const db = getFirestore();

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

/**
 * Fetches site information from Firebase with caching.
 * Cache is per-site and survives cold starts on Vercel.
 *
 * @param siteId - Optional site ID. If not provided, falls back to NEXT_SITE_ID env variable.
 *                 For multi-tenant deployments, this should be passed from resolveSiteId().
 * @returns Site info object or null if no valid site ID is provided
 */
export async function fetchSiteInfo(siteId?: string | null) {
  // Resolve siteId: use parameter if provided, otherwise fall back to env variable
  const resolvedSiteId = siteId || process.env.NEXT_SITE_ID;

  if (!resolvedSiteId) {
    console.warn('[fetchSiteInfo] No site ID provided and NEXT_SITE_ID not set');
    return null;
  }

  // Use unstable_cache with siteId in the cache key for multi-tenant support
  const getCachedSiteInfo = unstable_cache(
    async () => _fetchSiteInfoUncached(resolvedSiteId),
    [`site-info-${resolvedSiteId}`],
    {
      revalidate: 3600, // Revalidate every hour
      tags: [`site-info`, `site-${resolvedSiteId}`],
    }
  );

  return getCachedSiteInfo();
}

/**
 * Fetches the site ID for a given domain from the domain_mappings collection.
 * This provides secure mapping from public domains to private site document IDs.
 * Cache survives cold starts and works across Vercel instances.
 *
 * @param domain - The domain to look up (e.g., "aglamaz.com", "levi.famcircle.org")
 * @returns The site ID string, or null if no mapping exists
 */
export async function fetchSiteIdByDomain(domain: string): Promise<string | null> {
  const getCachedMapping = unstable_cache(
    async () => {
      initAdmin();
      const db = getFirestore();

      try {
        const doc = await db.collection('domain_mappings').doc(domain).get();

        if (!doc.exists) {
          return null;
        }

        const data = doc.data();
        return (data?.siteId as string) || null;
      } catch (error) {
        console.error(`[domain-mapping] failed to fetch siteId for domain ${domain}`, error);
        return null;
      }
    },
    [`domain-mapping-${domain}`],
    {
      revalidate: 3600, // Revalidate every hour
      tags: ['domain-mappings', `domain-${domain}`],
    }
  );

  return getCachedMapping();
}

/**
 * Fetches platform description from Firebase with caching.
 * This content is centralized and editable only by the platform owner.
 * Cache survives cold starts and works across Vercel instances.
 */
export const fetchPlatformDescription = unstable_cache(
  async () => {
    initAdmin();
    const db = getFirestore();

    try {
      // Fetch from 'platform' collection, 'description' document
      const doc = await db.collection('platform').doc('description').get();

      if (!doc.exists) {
        return {
          content: '',
          title: '',
          translations: {} as Record<string, { title: string; content: string }>,
        };
      }

      const data = doc.data() || {};
      return {
        content: (data.content as string) || '',
        title: (data.title as string) || '',
        translations: (data.translations as Record<string, { title: string; content: string }>) || {},
      };
    } catch (error) {
      console.error('[platform] failed to fetch platform description', error);
      return {
        content: '',
        title: '',
        translations: {} as Record<string, { title: string; content: string }>,
      };
    }
  },
  ['platform-description'],
  {
    revalidate: 3600, // Revalidate every hour
    tags: ['platform-description'],
  }
);
