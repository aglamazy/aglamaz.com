import type { AnniversaryEvent } from '@/entities/Anniversary';
import { MemberRepository } from '@/repositories/MemberRepository';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { BlessingMagicLinkRepository } from '@/repositories/BlessingMagicLinkRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { getBaseUrlForSite } from '@/utils/serverUrls';
import { buildHonoreeInviteEmail } from './BlessingInviteTemplateService';
import { resolveDigestSiteName } from './DigestTemplateService';
import { ResendService } from './ResendService';

const SOURCE_LOCALE = 'he';

/**
 * Sends the honoree a no-login, read-only, 48h magic link to their blessing
 * page (Agla, 2026-07-22: "All links should be magic links to read only
 * status, valid for 48h") - the SAME mechanism whether the honoree is an
 * existing member (honoreeMemberId) or not (honoreeEmail raw). Ensures the
 * blessing page exists first, so the link has somewhere real to land.
 */
export async function sendHonoreeBlessingLink(params: {
  siteId: string;
  event: AnniversaryEvent;
  honoreeMemberId?: string;
  honoreeEmail?: string;
  authorName: string;
}): Promise<void> {
  const { siteId, event, honoreeMemberId, honoreeEmail, authorName } = params;

  let targetEmail: string | undefined;
  let honoreeName = event.name;
  if (honoreeMemberId) {
    const memberRepo = new MemberRepository();
    const member = await memberRepo.getById(honoreeMemberId);
    targetEmail = member?.email;
    honoreeName = member?.firstName || member?.displayName || event.name;
  } else {
    targetEmail = honoreeEmail;
  }
  if (!targetEmail) {
    throw new Error(`No resolvable email for event ${event.id} honoree (memberId=${honoreeMemberId}, email=${honoreeEmail})`);
  }

  const blessingPageRepo = new BlessingPageRepository();
  const blessingPage = await blessingPageRepo.create({
    eventId: event.id,
    siteId,
    year: event.type === 'death' ? undefined : event.year,
    createdBy: honoreeMemberId || event.ownerId,
    eventType: event.type,
  });

  const magicLinkRepo = new BlessingMagicLinkRepository();
  const link = await magicLinkRepo.create({
    siteId,
    blessingPageId: blessingPage.id,
    honoreeLabel: event.name,
  });

  const siteRepo = new SiteRepository();
  const site = await siteRepo.get(siteId);
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }
  const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);
  const baseUrl = await getBaseUrlForSite(siteId);
  const blessingLinkUrl = `${baseUrl}/public/blessing-view/${link.token}`;

  const { subject, html } = buildHonoreeInviteEmail({
    locale: SOURCE_LOCALE,
    siteName,
    honoreeName,
    authorName,
    eventType: event.type,
    blessingLinkUrl,
  });

  await ResendService.sendTransactionalEmail({
    to: targetEmail,
    subject,
    html,
    lang: SOURCE_LOCALE,
  });
}
