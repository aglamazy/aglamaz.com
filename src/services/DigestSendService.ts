// Cadence-aware digest send (docs/family-digest-formats-spec.md §1): ONE mechanism, resolved
// per-member at send time, shared by both cron schedules (weekly + monthly - see
// src/app/api/cron/digest/route.ts and src/app/api/cron/digest-weekly/route.ts). Per the spec:
// "Avoid building a parallel 'weekly digest service' next to the monthly one" - this file IS
// that shared mechanism, parameterized by cadence, not a second system.

import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GalleryPhotoRepository } from '@/repositories/GalleryPhotoRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { notificationPreferencesRepository } from '@/repositories/NotificationPreferencesRepository';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName, replaceManageLink } from '@/services/DigestTemplateService';
import { ResendService } from '@/services/ResendService';
import {
  buildReminderPreferenceLink,
  signReminderPreferenceToken,
} from '@/services/ReminderPreferenceLinkService';
import type { ISite } from '@/entities/Site';
import type { MagazineCadence } from '@/repositories/NotificationPreferencesRepository.utils';

export type DigestCadence = Extract<MagazineCadence, 'weekly' | 'monthly'>;

export interface DigestSendCandidate {
  memberId: string;
  email?: string | null;
  magazineCadence: MagazineCadence;
  defaultLocale?: string;
}

/** Buckets active, emailed, cadence-matching members by locale so a given (site, cadence)
 * digest is compiled and rendered once per distinct locale, not once per member. */
export function groupMembersByCadenceAndLocale(
  members: DigestSendCandidate[],
  cadence: DigestCadence,
): Map<string, DigestSendCandidate[]> {
  const groups = new Map<string, DigestSendCandidate[]>();
  for (const member of members) {
    if (member.magazineCadence !== cadence) continue;
    if (!member.email) continue;
    const locale = member.defaultLocale ?? 'he';
    const bucket = groups.get(locale) ?? [];
    bucket.push(member);
    groups.set(locale, bucket);
  }
  return groups;
}

export function getPreviousMonth(reference: Date): { month: number; year: number } {
  const startOfMonthUtc = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  startOfMonthUtc.setUTCMonth(startOfMonthUtc.getUTCMonth() - 1);
  return {
    month: startOfMonthUtc.getUTCMonth(),
    year: startOfMonthUtc.getUTCFullYear(),
  };
}

/** "This week + up to ~1 month out" (spec §1) - a rolling window from today, not a fixed
 * calendar month. */
export function resolveWeeklyDigestWindow(referenceDate: Date): { startDate: Date; endDate: Date } {
  const startDate = new Date(referenceDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return { startDate, endDate };
}

export interface RunDigestCadenceResult {
  sites: number;
  sent: number;
  failed: number;
}

export interface RunDigestCadenceDeps {
  siteRepo?: Pick<SiteRepository, 'listAll'>;
  memberRepo?: Pick<MemberRepository, 'listActiveMembers'>;
  digestCompiler?: DigestCompilerService;
  now?: Date;
}

function getSiteName(site: ISite, locale: string, siteId: string): string {
  return resolveDigestSiteName(site, locale, siteId);
}

export async function runDigestCadence(
  cadence: DigestCadence,
  requestOrigin: string,
  deps: RunDigestCadenceDeps = {},
): Promise<RunDigestCadenceResult> {
  const siteRepo = deps.siteRepo ?? new SiteRepository();
  const memberRepo = deps.memberRepo ?? new MemberRepository();
  const digestCompiler = deps.digestCompiler ?? new DigestCompilerService(new AnniversaryRepository(), new GalleryPhotoRepository());
  const now = deps.now ?? new Date();

  const { month, year } = getPreviousMonth(now);
  const { startDate, endDate } = resolveWeeklyDigestWindow(now);

  let sites: ISite[] = [];
  try {
    sites = await siteRepo.listAll();
  } catch (err) {
    console.error(`[digest/${cadence}] failed to list sites:`, err);
    throw err;
  }

  let sent = 0;
  let failed = 0;

  for (const site of sites) {
    const siteId = site.id;
    try {
      const members = await memberRepo.listActiveMembers(siteId);
      const prefs = await Promise.all(
        members.map((m) => notificationPreferencesRepository.get(m.id, siteId)),
      );
      const candidates: DigestSendCandidate[] = members.map((m, i) => ({
        memberId: m.id,
        email: m.email,
        magazineCadence: prefs[i].magazineCadence,
        defaultLocale: m.defaultLocale,
      }));

      const groups = groupMembersByCadenceAndLocale(candidates, cadence);

      for (const [locale, groupMembers] of groups) {
        try {
          const siteName = getSiteName(site, locale, siteId);
          const content =
            cadence === 'weekly'
              ? DigestTemplateService.buildWeeklyDigestEmail(
                  await digestCompiler.compileDigestWindow(siteId, startDate, endDate, { locale }),
                  { locale, siteName },
                )
              : DigestTemplateService.buildMonthlyDigestEmail(
                  await digestCompiler.compileDigest(siteId, month, year, { locale }),
                  { locale, siteName },
                );

          for (const member of groupMembers) {
            try {
              const manageLink = buildReminderPreferenceLink(
                requestOrigin,
                signReminderPreferenceToken({ memberId: member.memberId, siteId, topic: 'birthday' }),
              );
              const personalized = replaceManageLink(content, manageLink);

              await ResendService.sendTransactionalEmail({
                to: member.email as string,
                subject: personalized.subject,
                html: personalized.html,
                lang: locale,
              });
              sent++;
              console.log(
                `[digest/${cadence}] sent: site=${siteId} member=${member.memberId} locale=${locale}`,
              );
            } catch (memberErr) {
              failed++;
              console.error(`[digest/${cadence}] error sending to member=${member.memberId}:`, memberErr);
            }
          }
        } catch (localeErr) {
          failed += groupMembers.length;
          console.error(
            `[digest/${cadence}] error compiling digest site=${siteId} locale=${locale}:`,
            localeErr,
          );
        }
      }
    } catch (err) {
      console.error(`[digest/${cadence}] error processing site ${siteId}:`, err);
    }
  }

  console.log(`[digest/${cadence}] complete: sites=${sites.length} sent=${sent} failed=${failed}`);
  return { sites: sites.length, sent, failed };
}
