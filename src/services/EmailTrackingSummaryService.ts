import { emailTrackingRepository, EmailTrackingRepository } from '@/repositories/EmailTrackingRepository';
import { digestSendRepository, type DigestCadence } from '@/repositories/DigestSendRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import type { EmailTrackingSendType } from '@/services/EmailTrackingService';

export interface EmailTrackingSendSummary {
  sendType: EmailTrackingSendType;
  sendId: string;
  /** Total recipients the send actually went to - only known for sendTypes with a "sent" ledger (today: digest, via digestSends). Null elsewhere. */
  sentCount: number | null;
  openedCount: number;
  clickedCount: number;
  lastEventAt: string;
}

function parseDigestSendId(sendId: string): { cadence: DigestCadence; periodKey: string } | null {
  const [cadence, periodKey] = sendId.split(':');
  if ((cadence === 'weekly' || cadence === 'monthly') && periodKey) {
    return { cadence, periodKey };
  }
  return null;
}

interface SendGroup {
  sendType: EmailTrackingSendType;
  sendId: string;
  opened: Set<string>;
  clicked: Set<string>;
  lastEventAtMillis: number;
}

/**
 * Groups the flat emailTrackingEvents log into one row per logical send (siteId+sendType+sendId)
 * - the per-send opened/clicked reconciliation the usage-data admin page needs. Digest sends also
 * get a sentCount from digestSendRepository, the SSOT for "how many members actually got it".
 */
export class EmailTrackingSummaryService {
  async getSummaryForSite(siteId: string): Promise<EmailTrackingSendSummary[]> {
    const events = await emailTrackingRepository.getEventsForSite(siteId);

    const groups = new Map<string, SendGroup>();
    for (const event of events) {
      const key = `${event.sendType}:${event.sendId}`;
      let group = groups.get(key);
      if (!group) {
        group = { sendType: event.sendType, sendId: event.sendId, opened: new Set(), clicked: new Set(), lastEventAtMillis: 0 };
        groups.set(key, group);
      }
      if (event.eventType === 'open') group.opened.add(event.recipientMemberId);
      if (event.eventType === 'click') group.clicked.add(event.recipientMemberId);
      group.lastEventAtMillis = Math.max(group.lastEventAtMillis, event.timestamp.toMillis());
    }

    const summaries = await Promise.all(
      Array.from(groups.values()).map(async (group): Promise<EmailTrackingSendSummary> => {
        let sentCount: number | null = null;
        if (group.sendType === 'digest') {
          const parsed = parseDigestSendId(group.sendId);
          if (parsed) {
            sentCount = await digestSendRepository.countSent(siteId, parsed.cadence, parsed.periodKey);
          }
        }
        return {
          sendType: group.sendType,
          sendId: group.sendId,
          sentCount,
          openedCount: group.opened.size,
          clickedCount: group.clicked.size,
          lastEventAt: new Date(group.lastEventAtMillis).toISOString(),
        };
      }),
    );

    return summaries.sort((a, b) => (a.lastEventAt < b.lastEventAt ? 1 : -1));
  }
}

export interface EmailTrackingRecipientDetail {
  memberId: string;
  /** Best-effort display label - falls back to the raw memberId if the member record is gone, never throws. */
  displayLabel: string;
  email: string | null;
  opened: boolean;
  clicked: boolean;
  firstOpenAt: string | null;
  lastEventAt: string;
}

/**
 * Per-recipient drill-down for one logical send (Agla, 2026-08-08: "who opened the
 * magazine" - the aggregate counts on the summary row weren't enough). One row per
 * recipient who opened OR clicked at least once - the parent summary row already carries
 * sentCount, so this view is deliberately "who engaged", not a full roster padded with
 * everyone who didn't.
 */
export class EmailTrackingDetailService {
  constructor(
    private readonly trackingRepository: EmailTrackingRepository = emailTrackingRepository,
    private readonly memberRepository: MemberRepository = new MemberRepository(),
  ) {}

  async getRecipientDetailForSend(
    siteId: string,
    sendType: EmailTrackingSendType,
    sendId: string,
  ): Promise<EmailTrackingRecipientDetail[]> {
    const events = await this.trackingRepository.getEventsForSend(siteId, sendType, sendId);

    const byRecipient = new Map<string, { opened: boolean; clicked: boolean; firstOpenMillis: number | null; lastEventMillis: number }>();
    for (const event of events) {
      let row = byRecipient.get(event.recipientMemberId);
      if (!row) {
        row = { opened: false, clicked: false, firstOpenMillis: null, lastEventMillis: 0 };
        byRecipient.set(event.recipientMemberId, row);
      }
      const millis = event.timestamp.toMillis();
      if (event.eventType === 'open') {
        row.opened = true;
        row.firstOpenMillis = row.firstOpenMillis === null ? millis : Math.min(row.firstOpenMillis, millis);
      }
      if (event.eventType === 'click') row.clicked = true;
      row.lastEventMillis = Math.max(row.lastEventMillis, millis);
    }

    const recipientIds = Array.from(byRecipient.keys());
    const members = await Promise.all(recipientIds.map((id) => this.memberRepository.getById(id).catch(() => null)));

    return recipientIds
      .map((memberId, i) => {
        const row = byRecipient.get(memberId)!;
        const member = members[i];
        const displayLabel = member ? member.displayNameLocalized || member.displayName || member.firstNameLocalized || member.firstName || member.email : memberId;
        return {
          memberId,
          displayLabel: displayLabel || memberId,
          email: member?.email ?? null,
          opened: row.opened,
          clicked: row.clicked,
          firstOpenAt: row.firstOpenMillis === null ? null : new Date(row.firstOpenMillis).toISOString(),
          lastEventAt: new Date(row.lastEventMillis).toISOString(),
        };
      })
      .sort((a, b) => (a.lastEventAt < b.lastEventAt ? 1 : -1));
  }
}

export const emailTrackingDetailService = new EmailTrackingDetailService();

export const emailTrackingSummaryService = new EmailTrackingSummaryService();
