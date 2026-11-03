import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

const COLLECTION = 'emailSends';

export type EmailCarrier = 'resend' | 'gmail';

/**
 * accepted - the carrier took the message (Resend 2xx / Gmail send returned).
 * skipped  - nothing was handed to a carrier (Resend with no RESEND_API_KEY, local dev).
 * failed   - the carrier refused or errored; `error` says why.
 */
export type EmailSendOutcome = 'accepted' | 'skipped' | 'failed';

export interface EmailSendRecord {
  kind: string;
  carrier: EmailCarrier;
  to: string;
  subject: string;
  outcome: EmailSendOutcome;
  siteId: string | null;
  recipientMemberId: string | null;
  sendId: string | null;
  lang: string | null;
  providerMessageId: string | null;
  error: string | null;
}

/**
 * FamCircle's own record of every email it sends (famcircle#201) - one document per send,
 * written by EmailService whatever the carrier said, so "what did we send" is answerable
 * from FamCircle's data and not only from Resend's. Server-only: no API route reads it.
 */
export class EmailSendRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async record(entry: EmailSendRecord): Promise<string> {
    const ref = await this.getDb()
      .collection(COLLECTION)
      .add({ ...entry, sentAt: Timestamp.now() });
    return ref.id;
  }
}

export const emailSendRepository = new EmailSendRepository();
