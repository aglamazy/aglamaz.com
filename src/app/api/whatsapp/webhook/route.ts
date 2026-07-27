// WhatsApp Cloud API webhook (famcircle#34 — agents-whatsapp scaffold, no glue).
//
// This is Meta's direct inbound webhook for the future agents-whatsapp-based
// integration — NOT a Vercel Cron job (hence it lives outside src/app/api/cron/),
// and NOT registered in src/entities/Routes.ts/src/utils/urls.ts, which only
// catalog this app's own apiFetch client calls (cron routes follow the same
// exclusion — see src/app/api/cron/*).
//
// UNRELATED to the existing yahrzeit broadcast system
// (src/services/WhatsAppService.ts + src/app/api/cron/yahrzeit-whatsapp) — that
// uses a bespoke WABA_BROADCAST_URL integration and is untouched by this route.
//
// Scaffold boundary ("no glue"): on a verified inbound event, this route does
// the minimum real thing — persist the raw payload to Firestore via
// WhatsAppInboxRepository. No AI processing, no auto-replies, no site/member
// resolution, no wiring into any existing business logic.
//
// Uses `createWebhookHandler` from the glue-free `agents-whatsapp/webhook`
// subpath (not the package root barrel, which re-exports the `glue` layer and
// its optional `agents-ai` peer — not installed in this repo, and not wanted
// yet per famcircle#34's scope).
import { NextRequest } from 'next/server';
import { createWebhookHandler, type WebhookHandlers } from 'agents-whatsapp/webhook';
import { WhatsAppInboxRepository } from '@/repositories/WhatsAppInboxRepository';

export const dynamic = 'force-dynamic';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`whatsapp/webhook: missing required environment variable ${name}`);
  }
  return value;
}

const repo = new WhatsAppInboxRepository();

// Built lazily (not at module load) so a missing WA_VERIFY_TOKEN/WA_APP_SECRET
// throws on the first real request rather than at import time — matching
// src/app/api/cron/yahrzeit-whatsapp/route.ts, which validates config inside
// its handler rather than at module scope, so `next build`'s route-manifest
// pass (which imports every route module) doesn't fail on unset env vars.
let handlers: WebhookHandlers | null = null;

function getHandlers(): WebhookHandlers {
  if (handlers) {
    return handlers;
  }

  handlers = createWebhookHandler({
    verifyToken: requireEnv('WA_VERIFY_TOKEN'),
    appSecret: requireEnv('WA_APP_SECRET'),
    storage: {
      saveInbound: (msg, ctx) => repo.saveInboundMessage(msg, ctx),
      updateStatus: (messageId, status) => repo.saveStatusUpdate(messageId, status),
    },
    // Required by the handler factory, but this scaffold does no glue-layer
    // processing (no AI reply, no routing) — persistence alone happens via
    // `storage.saveInbound` above, which the handler always calls first.
    onMessage: async () => {},
    onError: (err) => {
      console.error('[whatsapp/webhook] error processing payload:', err);
    },
  });

  return handlers;
}

export async function GET(request: NextRequest) {
  return getHandlers().handleGet(request);
}

export async function POST(request: NextRequest) {
  return getHandlers().handlePost(request);
}
