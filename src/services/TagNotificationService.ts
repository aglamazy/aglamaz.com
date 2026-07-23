// Event-triggered notification path (parallel to the date-computed cron/reminders pipeline):
// fires immediately at content-write time instead of waiting for a poll pass.

import { MemberRepository } from '@/repositories/MemberRepository';
import { ResendService, TaggedContentType } from '@/services/ResendService';

export interface NotifyTaggedMembersParams {
  siteId: string;
  siteName?: string;
  taggedMemberIds: string[];
  /** Member doc id of whoever added the tags — excluded from notification if self-tagged */
  taggedByMemberId: string;
  taggedByName: string;
  contentType: TaggedContentType;
  contentLink: string;
  /** Representative photo for the tagged content, resolved by the caller per contentType - omitted when none exists. */
  imageUrl?: string;
}

export class TagNotificationService {
  /**
   * Resolves memberIds to real members of the given site, deduped.
   * Callers should persist only this filtered list, so a stray/foreign id
   * never lands in taggedMemberIds.
   */
  static async filterSiteMemberIds(memberIds: string[] | undefined, siteId: string): Promise<string[]> {
    if (!memberIds || !memberIds.length) return [];
    const memberRepo = new MemberRepository();
    const unique = Array.from(new Set(memberIds.filter((id) => typeof id === 'string' && id.trim())));
    const members = await Promise.all(unique.map((id) => memberRepo.getById(id)));
    return unique.filter((id, i) => members[i]?.siteId === siteId);
  }

  /** Sends a "you were tagged" email to each member, skipping the tagger and members without an email. */
  static async notifyTaggedMembers(params: NotifyTaggedMembersParams): Promise<void> {
    const { siteId, siteName, taggedMemberIds, taggedByMemberId, taggedByName, contentType, contentLink, imageUrl } = params;
    if (!taggedMemberIds.length) return;

    const memberRepo = new MemberRepository();

    for (const memberId of taggedMemberIds) {
      if (memberId === taggedByMemberId) continue;

      try {
        const member = await memberRepo.getById(memberId);
        if (!member || member.siteId !== siteId || !member.email) continue;

        const lang = member.defaultLocale ?? 'he';
        const dir = lang === 'he' ? 'rtl' : 'ltr';

        const { subject, html } = ResendService.buildTagNotificationEmailHtml({
          firstName: member.firstName || member.displayName || member.email,
          taggedByName,
          contentType,
          contentLink,
          imageUrl,
          lang,
          dir,
          siteName,
        });

        console.log(
          `[TagNotificationService] sending: site=${siteId} member=${member.email} contentType=${contentType}`,
        );

        await ResendService.sendTransactionalEmail({ to: member.email, subject, html, lang });
      } catch (error) {
        console.error(
          `[TagNotificationService] failed to notify member=${memberId} contentType=${contentType}:`,
          error,
        );
      }
    }
  }
}
