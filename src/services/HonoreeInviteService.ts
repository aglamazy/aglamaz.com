import type { AnniversaryEvent } from '@/entities/Anniversary';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { SiteRepository } from '@/repositories/SiteRepository';
import { getUrl, AppRoute } from '@/utils/serverUrls';
import { buildHonoreeInviteEmail } from './BlessingInviteTemplateService';
import { resolveDigestSiteName } from './DigestTemplateService';
import { ResendService } from './ResendService';

const SOURCE_LOCALE = 'he';
const INVITE_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days - longer than the generic 24h invite link, since this sits in an inbox.

/**
 * Sends a honoree an invite to join the site and read the blessings written for
 * them - only path for reaching a person who isn't a member yet (event.honoreeEmail
 * set, no honoreeMemberId). Ensures their blessing page exists first, so the invite's
 * redirectPath has somewhere real to land them once they accept.
 */
export async function sendHonoreeInvite(params: {
  siteId: string;
  event: AnniversaryEvent;
  honoreeEmail: string;
  authorName: string;
  authorId?: string;
  authorEmail?: string;
}): Promise<void> {
  const { siteId, event, honoreeEmail, authorName, authorId, authorEmail } = params;

  const blessingPageRepo = new BlessingPageRepository();
  const blessingPage = await blessingPageRepo.create({
    eventId: event.id,
    siteId,
    year: event.type === 'death' ? undefined : event.year,
    createdBy: authorId || event.ownerId,
    eventType: event.type,
  });

  const siteRepo = new SiteRepository();
  const site = await siteRepo.get(siteId);
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }
  const siteName = resolveDigestSiteName(site, SOURCE_LOCALE, siteId);

  const familyRepository = new FamilyRepository();
  const invite = await familyRepository.createInvite(
    siteId,
    { id: authorId, email: authorEmail, name: authorName },
    {
      invitedEmail: honoreeEmail,
      // Manually built, matching TagNotificationService's existing precedent for this
      // same page - no AppRoute entry exists for /app/blessing/{slug} in the registry.
      redirectPath: `/app/blessing/${blessingPage.slug}`,
      expiresInMs: INVITE_EXPIRES_MS,
    },
  );

  const inviteUrl = await getUrl(AppRoute.AUTH_INVITE, siteId, { token: invite.token });

  const { subject, html } = buildHonoreeInviteEmail({
    locale: SOURCE_LOCALE,
    siteName,
    honoreeName: event.name,
    authorName,
    eventType: event.type,
    inviteUrl,
  });

  await ResendService.sendTransactionalEmail({
    to: honoreeEmail,
    subject,
    html,
    lang: SOURCE_LOCALE,
  });
}
