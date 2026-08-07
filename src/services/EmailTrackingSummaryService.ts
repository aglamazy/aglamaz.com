import { emailTrackingRepository } from '@/repositories/EmailTrackingRepository';
import { digestSendRepository, type DigestCadence } from '@/repositories/DigestSendRepository';
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

export const emailTrackingSummaryService = new EmailTrackingSummaryService();
