import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
// Type-only import from the package root: the glue-free `agents-whatsapp/webhook`
// subpath re-exports only `createWebhookHandler`/`verifyWebhookSignature`, not the
// payload shape types. `import type` is erased entirely at compile time (this repo's
// tsconfig has isolatedModules), so this never causes a runtime `require()` of the
// barrel — and the barrel's `glue` re-export (which needs the optional `agents-ai`
// peer) is therefore never pulled in. See agents-whatsapp src/webhook.ts + src/index.ts.
import type { WebhookMessage, MessageStatus, InboundContext } from 'agents-whatsapp';

/**
 * Raw-payload landing zone for agents-whatsapp webhook events (famcircle#34
 * — scaffold, no glue). Insert-only: the webhook route stashes whatever Meta
 * sent as-is, with no site/member resolution and no business-logic wiring.
 * A future feature that actually consumes these can add lookups/indexes then.
 */
export interface WhatsAppInboundMessageRecord {
  kind: 'message';
  message: WebhookMessage;
  ctx?: InboundContext;
  receivedAt: Timestamp;
}

export interface WhatsAppInboundStatusRecord {
  kind: 'status';
  messageId: string;
  status: MessageStatus;
  receivedAt: Timestamp;
}

export type WhatsAppInboxRecord = WhatsAppInboundMessageRecord | WhatsAppInboundStatusRecord;

export class WhatsAppInboxRepository {
  private readonly collection = 'whatsappInbox';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async saveInboundMessage(message: WebhookMessage, ctx?: InboundContext): Promise<void> {
    const db = this.getDb();
    const record: WhatsAppInboundMessageRecord = {
      kind: 'message',
      message,
      ...(ctx ? { ctx } : {}),
      receivedAt: Timestamp.now(),
    };
    await db.collection(this.collection).add(record);
  }

  async saveStatusUpdate(messageId: string, status: MessageStatus): Promise<void> {
    const db = this.getDb();
    const record: WhatsAppInboundStatusRecord = {
      kind: 'status',
      messageId,
      status,
      receivedAt: Timestamp.now(),
    };
    await db.collection(this.collection).add(record);
  }
}
