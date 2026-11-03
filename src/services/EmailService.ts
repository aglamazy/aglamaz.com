import type { EmailCarrier, EmailSendOutcome, EmailSendRecord } from '@/repositories/EmailSendRepository';
import type { TransactionalEmailTracking } from '@/services/ResendService';

/**
 * Every email FamCircle sends goes through EmailService.send (famcircle#201, Agla 2026-11-03:
 * "Each send go through it. It records internally every send (regardless of Resend)").
 *
 * The carriers (ResendService.deliver, GmailService.deliver) are transports only and are
 * called from here and nowhere else - tests/emailSinglePath.test.ts fails the build when a
 * carrier is reached from any other file. A send that bypasses this service would make the
 * record a lie, which is worse than having no record.
 */

export type EmailKind =
  | 'blessing-invite'
  | 'blog-review-request'
  | 'blog-autogen-admin'
  | 'blog-review-decision'
  | 'digest'
  | 'digest-preview'
  | 'tag-notification'
  | 'in-day-reminder'
  | 'welcome'
  | 'admin-notification'
  | 'password-reset'
  | 'invite-verification'
  | 'signup-verification';

export interface EmailSendRequest {
  kind: EmailKind;
  carrier: EmailCarrier;
  to: string;
  subject: string;
  html: string;
  text?: string;
  lang?: string;
  /** Recorded on the send; when tracking is given its siteId is used. */
  siteId?: string;
  /** Resend only: open-tracking pixel identity. */
  tracking?: TransactionalEmailTracking;
}

export interface CarrierResult {
  accepted: boolean;
  messageId?: string;
}

export interface EmailServiceDeps {
  carriers: Record<EmailCarrier, (req: EmailSendRequest) => Promise<CarrierResult>>;
  record: (entry: EmailSendRecord) => Promise<unknown>;
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export class EmailService {
  constructor(private readonly deps: EmailServiceDeps) {}

  /**
   * Sends through the request's carrier and records the send. Resolves true when the carrier
   * accepted it, false when it was skipped (Resend without a key); rethrows a carrier error
   * after recording it as failed, so callers keep their existing failure handling.
   */
  async send(req: EmailSendRequest): Promise<boolean> {
    let outcome: EmailSendOutcome;
    let messageId: string | undefined;
    let failure: unknown;

    try {
      const result = await this.deps.carriers[req.carrier](req);
      outcome = result.accepted ? 'accepted' : 'skipped';
      messageId = result.messageId;
    } catch (err) {
      outcome = 'failed';
      failure = err;
    }

    await this.writeRecord(req, outcome, messageId, failure);

    if (outcome === 'failed') throw failure;
    return outcome === 'accepted';
  }

  /**
   * A send whose record cannot be written is logged loudly, never silently dropped. It does
   * not throw: the email has already left (or failed) at the carrier, and turning a record
   * error into a send error would make a caller retry - a duplicate email to a family member.
   */
  private async writeRecord(
    req: EmailSendRequest,
    outcome: EmailSendOutcome,
    messageId: string | undefined,
    failure: unknown,
  ): Promise<void> {
    const entry: EmailSendRecord = {
      kind: req.kind,
      carrier: req.carrier,
      to: req.to,
      subject: req.subject,
      outcome,
      siteId: req.tracking?.siteId ?? req.siteId ?? null,
      recipientMemberId: req.tracking?.recipientMemberId ?? null,
      sendId: req.tracking?.sendId ?? null,
      lang: req.lang ?? null,
      providerMessageId: messageId ?? null,
      error: failure === undefined ? null : errorText(failure),
    };
    try {
      await this.deps.record(entry);
    } catch (err) {
      console.error(
        `[EmailService] SEND RECORD WRITE FAILED - kind=${entry.kind} carrier=${entry.carrier} ` +
          `outcome=${entry.outcome} site=${entry.siteId ?? '-'}: ${errorText(err)}`,
      );
    }
  }
}

/** The one instance callers use. Carriers are loaded lazily so tests can import this file without Firestore or googleapis. */
export const emailService = new EmailService({
  carriers: {
    resend: async (req) => {
      const { ResendService } = await import('@/services/ResendService');
      return ResendService.deliver(req);
    },
    gmail: async (req) => {
      const { GmailService } = await import('@/services/GmailService');
      const gmail = await GmailService.init();
      return gmail.deliver({ to: req.to, subject: req.subject, html: req.html, text: req.text });
    },
  },
  record: async (entry) => {
    const { emailSendRepository } = await import('@/repositories/EmailSendRepository');
    return emailSendRepository.record(entry);
  },
});
