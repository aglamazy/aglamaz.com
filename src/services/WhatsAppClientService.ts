/**
 * Thin, glue-free wrapper around agents-whatsapp's consumer send client
 * (famcircle#34 — foundation only, no callers yet).
 *
 * This is UNRELATED to `WhatsAppService.ts` (the bespoke yahrzeit-broadcast
 * integration that POSTs to `WABA_BROADCAST_URL`/`WABA_ACCESS_TOKEN`). That
 * system is separate and already working — do not merge the two.
 *
 * Imports from the `agents-whatsapp/client` subpath specifically, NOT the
 * package root barrel: the barrel re-exports the `glue` layer, which
 * statically imports the optional `agents-ai` peer. FamCircle does not (and,
 * per famcircle#34, should not yet) depend on `agents-ai`. The `/client`
 * subpath is glue-free — see agents-whatsapp's README "Import surfaces"
 * table and src/client.ts.
 *
 * Consumer-mode env vars (per the Hub spec's leaf contract — see
 * agents-whatsapp README "Two modes: hub vs consumer"):
 *   - WHATSAPP_TOKEN      — the leaf's injected access token
 *   - WA_PHONE_NUMBER_ID  — Meta phone number ID
 *   - WABA_ID             — delegated WABA id (display/template scope only)
 *
 * Per this repo's CLAUDE.md ("Never Use Fallback Values Without Permission"),
 * missing env vars throw rather than silently defaulting.
 */
import {
  createWhatsAppClient,
  type WhatsAppClient,
  type SendTextOptions,
  type SendTemplateOptions,
  type SendResult,
} from 'agents-whatsapp/client';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `WhatsAppClientService: missing required environment variable ${name}. ` +
        'Set WHATSAPP_TOKEN, WA_PHONE_NUMBER_ID, and WABA_ID before using this client.',
    );
  }
  return value;
}

let cachedClient: WhatsAppClient | null = null;

/**
 * Lazily constructs (and caches) the agents-whatsapp consumer send client
 * from the three injected leaf creds. Throws if any are missing — no
 * fallback values.
 */
export function getWhatsAppClient(): WhatsAppClient {
  if (cachedClient) {
    return cachedClient;
  }

  const accessToken = requireEnv('WHATSAPP_TOKEN');
  const phoneNumberId = requireEnv('WA_PHONE_NUMBER_ID');
  // WABA_ID is part of the injected leaf contract but is not consumed by
  // createWhatsAppClient today (display/template scope only) — reading it
  // here validates it's configured, matching the other two required creds.
  requireEnv('WABA_ID');

  cachedClient = createWhatsAppClient({
    phoneNumberId,
    accessToken,
  });

  return cachedClient;
}

/** Thin pass-through — send a free-form text message. */
export async function sendText(options: SendTextOptions): Promise<SendResult> {
  return getWhatsAppClient().sendText(options);
}

/** Thin pass-through — send an approved WABA template message. */
export async function sendTemplate(options: SendTemplateOptions): Promise<SendResult> {
  return getWhatsAppClient().sendTemplate(options);
}
