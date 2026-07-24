// Recipient + locale resolution shared by the real digest send cron
// (src/app/api/cron/digest/route.ts) and the digest preview cron
// (src/app/api/cron/digest-preview/route.ts). Both MUST compute this from the exact same
// code path - the 2026-07-24 "Arabic digest" incident (13 members got the wrong language)
// is the reason a preview cron exists at all, and a preview built from a re-implementation
// of this logic could silently drift from what the real send actually does.
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository, type LocalizedMemberRecord } from '@/repositories/MemberRepository';
import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import type { UnifiedMagazineCadence } from '@/repositories/NotificationPreferencesRepository';
import { resolveDigestSiteName } from '@/services/DigestTemplateService';
import { getMostRecentFieldVersion, normalizeLang } from '@/services/LocalizationService';
import { AppRoute } from '@/utils/urls';
import { getUrl } from '@/utils/serverUrls';
import type { ISite } from '@/entities/Site';

export const DIGEST_SOURCE_LOCALE = 'he';

export type SendableDigestCadence = Exclude<UnifiedMagazineCadence, 'none'>;

export type DigestLocaleTier = 'member' | 'site-default';

export interface DigestRecipient {
  member: LocalizedMemberRecord;
  locale: string;
  localeTier: DigestLocaleTier;
}

export interface DigestSendPlan {
  site: ISite;
  siteName: string;
  siteDefaultLocale: string;
  calendarUrl: string;
  galleryUrl: string;
  recipients: DigestRecipient[];
}

/**
 * Site-level locale fallback used when a member has no `defaultLocale` set - a loose
 * "whatever locale this site has any data in" guess (any stray `locales.*` key can hijack
 * it). Kept separate from `siteName` resolution, which always renders in DIGEST_SOURCE_LOCALE
 * regardless of this value (Agla, 2026-07-21: mixing the two produced a mixed-language digest).
 */
export function resolveDigestSiteDefaultLocale(site: ISite): string | null {
  const candidates = [
    getMostRecentFieldVersion(site, 'name')?.locale,
    getMostRecentFieldVersion(site, 'aboutFamily')?.locale,
    ...Object.keys(site.locales || {}),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeLang(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

/**
 * Resolves exactly which members get this cadence's digest and in which locale (member
 * preference, falling back to the site default with no further fallback) - returns null when
 * nobody on the site is eligible for this cadence, matching the real cron's "skip compiling
 * entirely" short-circuit.
 */
export async function resolveDigestSendPlan(
  siteId: string,
  cadence: SendableDigestCadence,
  opts?: { memberIdFilter?: string | null },
): Promise<DigestSendPlan | null> {
  const siteRepo = new SiteRepository();
  const memberRepo = new MemberRepository();

  const site = await siteRepo.get(siteId);
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  const members = await memberRepo.listActiveMembers(siteId);
  const prefs = await Promise.all(members.map((m) => notificationPreferencesRepository.get(m.id, siteId)));
  let eligible = members.filter((member, i) => prefs[i].magazineCadence === cadence && !!member.email);
  if (opts?.memberIdFilter) {
    eligible = eligible.filter((member) => member.id === opts.memberIdFilter);
  }

  if (eligible.length === 0) {
    return null;
  }

  const siteDefaultLocale = resolveDigestSiteDefaultLocale(site);
  if (!siteDefaultLocale) {
    throw new Error(`Unable to resolve digest locale for site ${siteId}`);
  }

  const siteName = resolveDigestSiteName(site, DIGEST_SOURCE_LOCALE, siteId);
  // Per-site canonical domain, not the caller's runtime host - a request against localhost
  // or a Vercel preview deployment must never bake that host into a sent link.
  const calendarUrl = await getUrl(AppRoute.APP_CALENDAR, siteId);
  const galleryUrl = await getUrl(AppRoute.APP_PHOTOS, siteId);

  const recipients: DigestRecipient[] = eligible.map((member) => {
    const memberLocale = normalizeLang(member.defaultLocale);
    return {
      member,
      locale: memberLocale ?? siteDefaultLocale,
      localeTier: memberLocale ? 'member' : 'site-default',
    };
  });

  return { site, siteName, siteDefaultLocale, calendarUrl, galleryUrl, recipients };
}
