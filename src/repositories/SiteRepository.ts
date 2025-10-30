import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { unstable_cache, revalidateTag } from 'next/cache';
import nextI18NextConfig from '../../next-i18next.config.js';
import { initAdmin } from '@/firebase/admin';
import { TranslationService } from '@/services/TranslationService';
import { saveLocalizedContent } from '@/services/LocalizationService';
import type { ISite } from '@/entities/Site';

const SUPPORTED_LOCALES: string[] = Array.isArray(nextI18NextConfig?.i18n?.locales)
  ? nextI18NextConfig.i18n.locales
  : ['en'];

export class TranslationDisabledError extends Error {
  constructor(public readonly locale: string) {
    super(`Translation service disabled for locale ${locale}`);
    this.name = 'TranslationDisabledError';
  }
}

export class SiteNotFoundError extends Error {
  constructor(public readonly siteId: string) {
    super(`Site ${siteId} not found`);
    this.name = 'SiteNotFoundError';
  }
}

interface GetOptions {
  cached?: boolean;
}

interface UpdateSiteContentParams {
  siteId: string;
  locale: string;
  name?: string;
  aboutFamily?: string;
  platformName?: string;
  requestTranslations?: boolean;
  supportedLocales?: string[];
}

interface UpdateAboutParams {
  siteId: string;
  aboutFamily: string;
  sourceLang: string;
  supportedLocales: string[];
}

export class SiteRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private siteDocRef(siteId: string) {
    return this.getDb().collection('sites').doc(siteId);
  }

  private domainMappingRef(domain: string) {
    return this.getDb().collection('domain_mappings').doc(domain);
  }

  async get(siteId: string, locale?: string | null, opts?: GetOptions): Promise<ISite | null> {
    const fetcher = async () => {
      let site = await this.fetchSite(siteId, locale ?? undefined);
      if (!site) return null;

      // If locale is specified, flatten the localized content to top-level
      if (locale) {
        const { getLocalizedFields } = await import('@/services/LocalizationService');
        const { SITE_TRANSLATABLE_FIELDS } = await import('@/entities/Site');
        const localizedFields = getLocalizedFields(site, locale, [...SITE_TRANSLATABLE_FIELDS]);

        // Apply localized fields to the site and remove locales to avoid sending
        // unnecessary data to client (and prevent Timestamp serialization issues)
        const { locales, ...siteWithoutLocales } = site;
        site = {
          ...siteWithoutLocales,
          ...localizedFields,
        };
      }

      return site;
    };

    if (opts?.cached) {
      const cacheKey = [`site-record-${siteId}`, locale ? `locale-${locale}` : 'default'];
      const cachedFn = unstable_cache(fetcher, cacheKey, {
        revalidate: 3600,
        tags: ['site-info', `site-${siteId}`],
      });
      return cachedFn();
    }

    return fetcher();
  }

  async getDescription(siteId: string, opts?: GetOptions): Promise<{
    locales: Record<string, { title?: string; content?: string }>;
  }> {
    const fetcher = async () => {
      const site = await this.fetchSite(siteId);
      if (!site) {
        throw new SiteNotFoundError(siteId);
      }

      // Build description from locales (if description fields exist)
      const locales: Record<string, { title?: string; content?: string }> = {};
      for (const [locale, content] of Object.entries(site.locales || {})) {
        const desc: { title?: string; content?: string } = {};
        if ((content as any).descriptionTitle) desc.title = (content as any).descriptionTitle;
        if ((content as any).descriptionContent) desc.content = (content as any).descriptionContent;
        if (desc.title || desc.content) {
          locales[locale] = desc;
        }
      }

      return { locales };
    };

    if (opts?.cached) {
      const cachedFn = unstable_cache(fetcher, [`site-description-${siteId}`], {
        revalidate: 3600,
        tags: ['site-description', `site-${siteId}`],
      });
      return cachedFn();
    }

    return fetcher();
  }

  async updateSiteContent(params: UpdateSiteContentParams): Promise<void> {
    const { siteId, locale, name, aboutFamily, platformName, requestTranslations, supportedLocales } = params;
    const docRef = this.siteDocRef(siteId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new SiteNotFoundError(siteId);
    }

    const site = this.deserializeSite(snap.id, snap.data() || {});
    const now = Timestamp.now();

    // Build content updates
    const contentUpdates: Record<string, any> = {};
    if (name !== undefined) contentUpdates.name = name;
    if (aboutFamily !== undefined) contentUpdates.aboutFamily = aboutFamily;
    if (platformName !== undefined) contentUpdates.platformName = platformName;

    // Save using generic LocalizationService and get updated state
    const nextSite = await saveLocalizedContent(docRef, site, locale, contentUpdates, 'manual', now);

    // Invalidate cache
    await this.revalidateSite(siteId);

    const localeTargetsSource = supportedLocales && supportedLocales.length ? supportedLocales : SUPPORTED_LOCALES;

    if (requestTranslations && TranslationService.isEnabled() && localeTargetsSource.length) {
      const targets: string[] = [];
      for (const targetLocale of localeTargetsSource) {
        if (targetLocale === locale) continue; // Skip the locale we just updated
        if (nextSite.locales?.[targetLocale]) continue; // Skip if already exists
        targets.push(targetLocale);
      }

      if (targets.length) {
        void this.translateMissingLocales({
          siteId,
          localeTargets: targets,
          docRef,
          updatedSite: nextSite,
        });
      }
    }
  }

  async updateAbout(params: UpdateAboutParams): Promise<{ aboutTranslations: Record<string, string> }> {
    const { siteId, aboutFamily, sourceLang, supportedLocales } = params;
    const docRef = this.siteDocRef(siteId);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new SiteNotFoundError(siteId);
    }

    const site = this.deserializeSite(snap.id, snap.data() || {});
    const trimmed = aboutFamily.trim();
    const now = Timestamp.now();

    // Save the aboutFamily in the sourceLang locale
    await saveLocalizedContent(
      docRef,
      site,
      sourceLang,
      { aboutFamily },
      'manual',
      now
    );

    const localeList = supportedLocales && supportedLocales.length ? supportedLocales : SUPPORTED_LOCALES;
    const translations: Record<string, string> = { [sourceLang]: aboutFamily };

    // Translate to other locales if enabled
    if (TranslationService.isEnabled() && trimmed) {
      for (const locale of localeList) {
        if (locale === sourceLang) continue;

        try {
          translations[locale] = await TranslationService.translateText({
            text: aboutFamily,
            from: sourceLang,
            to: locale,
          });

          await saveLocalizedContent(
            docRef,
            site,
            locale,
            { aboutFamily: translations[locale] },
            'gpt',
            now
          );
        } catch (error) {
          console.error(`[site] failed to translate aboutFamily to ${locale}`, error);
          translations[locale] = aboutFamily;
        }
      }
    }

    await this.revalidateSite(siteId);
    return { aboutTranslations: translations };
  }

  async getSettings(siteId: string): Promise<{
    aboutFamily: string;
    sourceLang: string;
    aboutTranslations: Record<string, string>;
  }> {
    const site = await this.fetchSite(siteId);
    if (!site) {
      throw new SiteNotFoundError(siteId);
    }

    // Build aboutTranslations from locales
    const aboutTranslations: Record<string, string> = {};
    for (const [locale, content] of Object.entries(site.locales || {})) {
      if (content.aboutFamily) {
        aboutTranslations[locale] = content.aboutFamily;
      }
    }

    // Find which locale has the most recent aboutFamily (as pseudo "source")
    const { getMostRecentFieldVersion } = await import('@/services/LocalizationService');
    const mostRecent = getMostRecentFieldVersion(site, 'aboutFamily');
    const sourceLang = mostRecent?.locale || 'he';

    return {
      aboutFamily: mostRecent?.value || '',
      sourceLang,
      aboutTranslations,
    };
  }

  async getIdByDomain(domain: string, opts?: GetOptions): Promise<string | null> {
    const fetcher = async () => {
      const snap = await this.domainMappingRef(domain).get();
      if (!snap.exists) return null;
      const data = snap.data();
      return (data?.siteId as string) || null;
    };

    if (opts?.cached) {
      const cachedFn = unstable_cache(fetcher, [`domain-mapping-${domain}`], {
        revalidate: 3600,
        tags: ['domain-mappings', `domain-${domain}`],
      });
      return cachedFn();
    }

    return fetcher();
  }

  async revalidateSite(siteId: string) {
    revalidateTag(`site-${siteId}`);
    revalidateTag('site-info');
    revalidateTag('site-description');
  }

  private async fetchSite(siteId: string, locale?: string): Promise<ISite | null> {
    const docRef = this.siteDocRef(siteId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return null;
    }
    let site = this.deserializeSite(snap.id, snap.data() || {});

    if (locale) {
      try {
        site = await this.ensureLocale(site, docRef, locale);
      } catch (error) {
        if (error instanceof TranslationDisabledError) {
          throw error;
        }
        console.error(`[site] failed to ensure locale ${locale} for site ${siteId}`, error);
      }
    }

    return site;
  }

  private deserializeSite(id: string, data: FirebaseFirestore.DocumentData): ISite {
    const plain: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Timestamp) {
        plain[key] = value.toDate().toISOString();
      } else {
        plain[key] = value;
      }
    }

    return {
      id,
      ownerUid: (plain.ownerUid as string) || '',
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
      locales: (plain.locales as ISite['locales']) || {},
    } as ISite;
  }

  private async ensureLocale(
    site: ISite,
    docRef: FirebaseFirestore.DocumentReference,
    locale: string,
  ): Promise<ISite> {
    const normalizedLocale = locale.trim();

    if (!normalizedLocale) {
      return site;
    }

    const locales = { ...(site.locales || {}) };
    const existing = locales[normalizedLocale];

    // Check if locale already has content
    if (existing && (existing.name || existing.aboutFamily || existing.platformName)) {
      return site;
    }

    if (!TranslationService.isEnabled()) {
      throw new TranslationDisabledError(normalizedLocale);
    }

    const now = Timestamp.now();

    // Find source content to translate from (most recent version of each field)
    const { getMostRecentFieldVersion } = await import('@/services/LocalizationService');

    const nameSource = getMostRecentFieldVersion(site, 'name');
    const aboutSource = getMostRecentFieldVersion(site, 'aboutFamily');
    const platformSource = getMostRecentFieldVersion(site, 'platformName');

    if (!nameSource && !aboutSource && !platformSource) {
      // No content to translate from
      return site;
    }

    try {
      const translatedFields: Record<string, any> = {};

      translatedFields.name = await TranslationService.translateText({
        text: nameSource?.value,
        from: nameSource?.locale,
        to: normalizedLocale,
      });

      translatedFields.aboutFamily = await TranslationService.translateText({
        text: aboutSource?.value,
        from: aboutSource?.locale,
        to: normalizedLocale,
      });

      translatedFields.platformName = await TranslationService.translateText({
        text: platformSource?.value,
        from: platformSource?.locale,
        to: normalizedLocale,
      });

      // Save translated content with 'gpt' source
      const { saveLocalizedContent } = await import('@/services/LocalizationService');
      const updatedSite = await saveLocalizedContent(
        docRef,
        site,
        normalizedLocale,
        translatedFields,
        'gpt',
        now
      );
      await this.revalidateSite(site.id);

      return updatedSite;
    } catch (error) {
      console.error(`[site] failed to translate locale ${normalizedLocale} for site ${site.id}`, error);
      // On error, don't create fallback content - just return original site
      return site;
    }
  }

  private async translateMissingLocales(params: {
    siteId: string;
    localeTargets: string[];
    docRef: FirebaseFirestore.DocumentReference;
    updatedSite: ISite;
  }) {
    const { siteId, localeTargets, docRef, updatedSite } = params;
    const { getMostRecentFieldVersion } = await import('@/services/LocalizationService');

    for (const targetLocale of localeTargets) {
      try {
        console.log('[site-translation] start', { siteId, to: targetLocale });

        // For each field, find the most recent version to translate from
        const nameSource = getMostRecentFieldVersion(updatedSite, 'name');
        const aboutSource = getMostRecentFieldVersion(updatedSite, 'aboutFamily');
        const platformSource = getMostRecentFieldVersion(updatedSite, 'platformName');

        const translatedFields: Record<string, any> = {};

        translatedFields.name = await TranslationService.translateText({
          text: nameSource?.value,
          from: nameSource?.locale,
          to: targetLocale,
        });

        translatedFields.aboutFamily = await TranslationService.translateText({
          text: aboutSource?.value,
          from: aboutSource?.locale,
          to: targetLocale,
        });

        translatedFields.platformName = await TranslationService.translateText({
          text: platformSource?.value,
          from: platformSource?.locale,
          to: targetLocale,
        });

        // Save translated content with 'gpt' source
        const { saveLocalizedContent } = await import('@/services/LocalizationService');
        await saveLocalizedContent(
          docRef,
          updatedSite,
          targetLocale,
          translatedFields,
          'gpt',
          Timestamp.now()
        );
        await this.revalidateSite(siteId);
        console.log('[site-translation] complete', { siteId, to: targetLocale });
      } catch (error) {
        console.error(`Background site translation failed for ${siteId} to ${targetLocale}:`, error);
      }
    }
  }
}
