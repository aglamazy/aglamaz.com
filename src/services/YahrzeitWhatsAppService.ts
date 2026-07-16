// Yahrzeit-day synchronized WhatsApp send service.
// Actual delivery is gated on WHATSAPP_API_TOKEN + WHATSAPP_PHONE_NUMBER_ID
// (famcircle#28 / WABA integration). Missing env → silent no-op.

export interface YahrzeitWAMessageParams {
  eventName: string;
  familyName: string;
  siteUrl: string;
  lang?: string;
}

export interface WADeliveryResult {
  sent: boolean;
  reason?: string;
}

export class YahrzeitWhatsAppService {
  static buildMessage(params: YahrzeitWAMessageParams): string {
    const { eventName, familyName, siteUrl, lang = 'he' } = params;

    if (lang === 'he') {
      return `🕯️ היום יארצייט של ${eventName}\nמשפחת ${familyName} נזכרת יחד היום.\n\n${siteUrl}`;
    }

    if (lang === 'tr') {
      return `🕯️ Bugün ${eventName}'in yahrzeiti\n${familyName} ailesi bugün birlikte anıyor.\n\n${siteUrl}`;
    }

    // Default: English
    return `🕯️ Today is ${eventName}'s yahrzeit\nThe ${familyName} family remembers together today.\n\n${siteUrl}`;
  }

  static async sendMessage(to: string, body: string): Promise<WADeliveryResult> {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      console.warn('[YahrzeitWhatsApp] WABA not configured — WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing');
      return { sent: false, reason: 'waba_not_configured' };
    }

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body },
        }),
      });
    } catch (err) {
      console.error('[YahrzeitWhatsApp] fetch error:', err);
      return { sent: false, reason: 'fetch_error' };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[YahrzeitWhatsApp] WABA API ${res.status}: ${text}`);
      return { sent: false, reason: `waba_${res.status}` };
    }

    return { sent: true };
  }
}
