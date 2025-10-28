import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { unstable_cache, revalidateTag } from 'next/cache';
import nextI18NextConfig from '../../next-i18next.config.js';
import { initAdmin } from '@/firebase/admin';
import { TranslationService } from '@/services/TranslationService';
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

export interface SiteDescription {
  title: string;
  content: string;
  translations: Record<string, { title: string; content: string }>;
}

export interface SiteRecord extends ISite {
  description?: SiteDescription;
  aboutTranslations?: Record<string, string>;
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

  async get(siteId: string, locale?: string | null, opts?: GetOptions): Promise<SiteRecord | null> {
    const fetcher = async () => this.fetchSite(siteId, locale ?? undefined);
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

  async getDescription(siteId: string, opts?: GetOptions): Promise<SiteDescription> {
    const fetcher = async () => {
      const site = await this.fetchSite(siteId);
      if (!site) {
        throw new SiteNotFoundError(siteId);
      }
      return (
        site.description || {
          title: '',
          content: '',
          translations: {},
        }
      );
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
    const sourceLang = site.sourceLang || 'en';
    const now = Timestamp.now();
    const updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = { updatedAt: now };

    const nextSite: SiteRecord = { ...site };

    if (locale === sourceLang) {
      if (name !== undefined) {
        updates.name = name;
        nextSite.name = name;
      }
      if (aboutFamily !== undefined) {
        updates.aboutFamily = aboutFamily;
        nextSite.aboutFamily = aboutFamily;
      }
      if (platformName !== undefined) {
        updates.platformName = platformName;
        nextSite.platformName = platformName;
      }
    } else {
      const translations = { ...(site.translations || {}) };
      const existing = translations[locale] || {
        name: '',
        aboutFamily: '',
        platformName: '',
        translatedAt: now,
        engine: 'manual' as const,
      };

      const updatedTranslation = {
        ...existing,
        name: name !== undefined ? name : existing.name,
        aboutFamily: aboutFamily !== undefined ? aboutFamily : existing.aboutFamily,
        platformName: platformName !== undefined ? platformName : existing.platformName,
        translatedAt: now,
        engine: 'manual' as const,
      };

      updates[`translations.${locale}`] = updatedTranslation;
      translations[locale] = updatedTranslation;
      nextSite.translations = translations;
    }

    if (Object.keys(updates).length > 1) {
      await docRef.update(updates);
      await this.revalidateSite(siteId);
    }

    const localeTargetsSource = supportedLocales && supportedLocales.length ? supportedLocales : SUPPORTED_LOCALES;

    if (requestTranslations && TranslationService.isEnabled() && localeTargetsSource.length) {
      const translationMeta = {
        ...(site.translationMeta || {}),
        requested: { ...(site.translationMeta?.requested || {}) },
      };
      const targets: string[] = [];
      for (const targetLocale of localeTargetsSource) {
        if (targetLocale === sourceLang) continue;
        if (nextSite.translations?.[targetLocale]) continue;
        translationMeta.requested[targetLocale] = now;
        targets.push(targetLocale);
      }

      if (targets.length) {
        await docRef.update({ translationMeta });
        await this.revalidateSite(siteId);
        const base = {
          name: nextSite.name || site.name,
          aboutFamily: nextSite.aboutFamily ?? site.aboutFamily ?? null,
          platformName: nextSite.platformName ?? site.platformName ?? null,
        };
        void this.translateMissingLocales({
          siteId,
          localeTargets: targets,
          sourceLang,
          docRef,
          base,
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

    const trimmed = aboutFamily.trim();
    const translations: Record<string, string> = {};

    const localeList = supportedLocales && supportedLocales.length ? supportedLocales : SUPPORTED_LOCALES;

    if (TranslationService.isEnabled() && trimmed) {
      for (const locale of localeList) {
        if (locale === sourceLang) {
          translations[locale] = aboutFamily;
          continue;
        }

        try {
          const result = await TranslationService.translateHtml({
            title: '',
            content: aboutFamily,
            from: sourceLang,
            to: locale,
          });
          translations[locale] = result.content || aboutFamily;
        } catch (error) {
          console.error(`[site] failed to translate aboutFamily to ${locale}`, error);
          translations[locale] = aboutFamily;
        }
      }
    } else {
      for (const locale of localeList) {
        translations[locale] = aboutFamily;
      }
    }

    const now = Timestamp.now();
    await docRef.update({
      aboutFamily,
      sourceLang,
      aboutTranslations: translations,
      updatedAt: now,
    });
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
    return {
      aboutFamily: site.aboutFamily || '',
      sourceLang: site.sourceLang || 'he',
      aboutTranslations: site.aboutTranslations || {},
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

  private async fetchSite(siteId: string, locale?: string): Promise<SiteRecord | null> {
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

  private deserializeSite(id: string, data: FirebaseFirestore.DocumentData): SiteRecord {
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
      name: (plain.name as string) || '',
      ownerUid: (plain.ownerUid as string) || '',
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
      sourceLang: (plain.sourceLang as string) || 'en',
      translations: (plain.translations as SiteRecord['translations']) || {},
      translationMeta: (plain.translationMeta as SiteRecord['translationMeta']) || {},
      aboutFamily: (plain.aboutFamily as string) || '',
      platformName: (plain.platformName as string) || '',
      description: (plain.description as SiteDescription) || undefined,
      aboutTranslations: (plain.aboutTranslations as Record<string, string>) || undefined,
    } as SiteRecord;
  }

  private async ensureLocale(
    site: SiteRecord,
    docRef: FirebaseFirestore.DocumentReference,
    locale: string,
  ): Promise<SiteRecord> {
    const normalizedLocale = locale.trim();
    const sourceLang = site.sourceLang || 'en';
    if (!normalizedLocale || normalizedLocale === sourceLang) {
      return site;
    }

    const translations = { ...(site.translations || {}) };
    const existing = translations[normalizedLocale];
    if (existing && existing.name) {
      return site;
    }

    if (!TranslationService.isEnabled()) {
      throw new TranslationDisabledError(normalizedLocale);
    }

    const now = Timestamp.now();

    try {
      const [translatedName, translatedAbout, translatedPlatform] = await Promise.all([
        TranslationService.translateHtml({
          title: site.name || '',
          content: '',
          from: sourceLang,
          to: normalizedLocale,
        }),
        site.aboutFamily
          ? TranslationService.translateHtml({
              title: '',
              content: site.aboutFamily,
              from: sourceLang,
              to: normalizedLocale,
            })
          : Promise.resolve({ title: '', content: '' }),
        site.platformName
          ? TranslationService.translateHtml({
              title: site.platformName,
              content: '',
              from: sourceLang,
              to: normalizedLocale,
            })
          : Promise.resolve({ title: '', content: '' }),
      ]);

      const translation = {
        name: translatedName.title || site.name || '',
        aboutFamily: translatedAbout.content || site.aboutFamily || '',
        platformName: translatedPlatform.title || site.platformName || '',
        translatedAt: now,
        engine: 'gpt' as const,
      };

      const translationMeta = {
        ...(site.translationMeta || {}),
        requested: { ...(site.translationMeta?.requested || {}) },
      };
      translationMeta.requested[normalizedLocale] = now;

      await docRef.update({
        [`translations.${normalizedLocale}`]: translation,
        translationMeta,
        updatedAt: now,
      });
      await this.revalidateSite(site.id);

      translations[normalizedLocale] = translation;
      return {
        ...site,
        translations,
        translationMeta,
      };
    } catch (error) {
      console.error(`[site] failed to translate locale ${normalizedLocale} for site ${site.id}`, error);
      const fallback = {
        name: site.name || '',
        aboutFamily: site.aboutFamily || '',
        platformName: site.platformName || '',
        translatedAt: now,
        engine: 'manual' as const,
      };

      await docRef.update({
        [`translations.${normalizedLocale}`]: fallback,
        updatedAt: now,
      });
      await this.revalidateSite(site.id);

      translations[normalizedLocale] = fallback;
      return {
        ...site,
        translations,
      };
    }
  }

  private async translateMissingLocales(params: {
    siteId: string;
    localeTargets: string[];
    sourceLang: string;
    docRef: FirebaseFirestore.DocumentReference;
    base: {
      name?: string | null;
      aboutFamily?: string | null;
      platformName?: string | null;
    };
  }) {
    const { siteId, localeTargets, sourceLang, docRef, base } = params;

    for (const targetLocale of localeTargets) {
      try {
        console.log('[site-translation] start', { siteId, to: targetLocale });
        const [translatedName, translatedAbout, translatedPlatform] = await Promise.all([
          TranslationService.translateHtml({
            title: base.name || '',
            content: '',
            from: sourceLang,
            to: targetLocale,
          }),
          base.aboutFamily
            ? TranslationService.translateHtml({
                title: '',
                content: base.aboutFamily,
                from: sourceLang,
                to: targetLocale,
              })
            : Promise.resolve({ title: '', content: '' }),
          base.platformName
            ? TranslationService.translateHtml({
                title: base.platformName,
                content: '',
                from: sourceLang,
                to: targetLocale,
              })
            : Promise.resolve({ title: '', content: '' }),
        ]);

        const translation = {
          name: translatedName.title || base.name || '',
          aboutFamily: translatedAbout.content || base.aboutFamily || '',
          platformName: translatedPlatform.title || base.platformName || '',
          translatedAt: Timestamp.now(),
          engine: 'gpt' as const,
        };

        await docRef.update({
          [`translations.${targetLocale}`]: translation,
          updatedAt: Timestamp.now(),
        });
        await this.revalidateSite(siteId);
        console.log('[site-translation] complete', { siteId, to: targetLocale });
      } catch (error) {
        console.error(`Background site translation failed for ${siteId} to ${targetLocale}:`, error);
      }
    }
  }
}
