// Shared recipient/locale resolution for the digest send path - used by BOTH the real
// cron (src/app/api/cron/digest/route.ts) and the admin-triggered preview
// (src/app/api/site/[siteId]/digest-preview-send/route.ts), so there is exactly ONE place
// that decides who gets a digest and in what language (Agla, 2026-07-24 - the "Arabic
// digest" incident: DRY was the whole point of building this after the fact).
import { SiteRepository } from '@/repositories/SiteRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import { digestSendRepository, type DigestCadence } from '@/repositories/DigestSendRepository';
import { normalizeLang } from '@/services/LocalizationService';
import type { ISite } from '@/entities/Site';
import type { LocalizedMemberRecord } from '@/repositories/MemberRepository';

export interface DigestRecipientPlan {
  member: LocalizedMemberRecord;
  locale: string;
  localeSource: 'member' | 'site';
}

export class SiteDefaultLocaleMissingError extends Error {
  constructor(public readonly siteId: string) {
    super(`Site ${siteId} has no defaultLocale configured - set it in /admin/site-settings`);
    this.name = 'SiteDefaultLocaleMissingError';
  }
}

/**
 * Every member on the site who wants this cadence, with their resolved send locale.
 * No locale fallback beyond member.defaultLocale -> site.defaultLocale - throws
 * SiteDefaultLocaleMissingError if the site itself has no configured default, rather than
 * guessing (Agla, 2026-07-24).
 *
 * @param onlyUnsent - when true (the real cron), filters out members already sent to this
 *   period (DigestSendRepository dedup). When false (preview), shows everyone eligible
 *   regardless of dedup state, since a preview isn't "sending" anything.
 */
export async function resolveDigestRecipients(
  siteId: string,
  cadence: DigestCadence,
  periodKey: string,
  options: { onlyUnsent: boolean; memberIdFilter?: string | null },
): Promise<{ site: ISite; recipients: DigestRecipientPlan[] }> {
  const siteRepo = new SiteRepository();
  const memberRepo = new MemberRepository();

  const site = await siteRepo.get(siteId);
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }
  if (!site.defaultLocale) {
    throw new SiteDefaultLocaleMissingError(siteId);
  }

  const members = await memberRepo.listActiveMembers(siteId);
  const prefs = await Promise.all(members.map((m) => notificationPreferencesRepository.get(m.id, siteId)));
  let eligible = members.filter((member, i) => prefs[i].magazineCadence === cadence && !!member.email);
  if (options.memberIdFilter) {
    eligible = eligible.filter((member) => member.id === options.memberIdFilter);
  }
  if (options.onlyUnsent) {
    eligible = await digestSendRepository.filterUnsent(siteId, cadence, periodKey, eligible);
  }

  const recipients: DigestRecipientPlan[] = eligible.map((member) => {
    const memberLocale = normalizeLang(member.defaultLocale);
    return {
      member,
      locale: memberLocale ?? site.defaultLocale!,
      localeSource: memberLocale ? 'member' : 'site',
    };
  });

  return { site, recipients };
}
