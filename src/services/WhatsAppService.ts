interface SendYahrzeitBroadcastParams {
  siteId: string;
  siteName: string;
  eventId: string;
  eventName: string;
  occurrenceDate: string;
  siteUrl: string;
  locale: string;
  year: number;
}

interface WhatsAppBroadcastPayload {
  siteId: string;
  siteName: string;
  eventId: string;
  eventName: string;
  occurrenceDate: string;
  siteUrl: string;
  locale: string;
  year: number;
  topic: 'yahrzeit';
  message: string;
}

interface WhatsAppConfig {
  broadcastUrl: string;
  accessToken: string;
}

function normalizeLocale(locale: string): 'he' | 'tr' | 'en' {
  const base = (locale || '').toLowerCase().split('-')[0];
  if (base === 'he' || base === 'tr') {
    return base;
  }
  return 'en';
}

function getConfig(): WhatsAppConfig {
  const broadcastUrl = process.env.WABA_BROADCAST_URL;
  const accessToken = process.env.WABA_ACCESS_TOKEN;

  if (!broadcastUrl) {
    throw new Error('WABA_BROADCAST_URL is not configured');
  }
  if (!accessToken) {
    throw new Error('WABA_ACCESS_TOKEN is not configured');
  }

  return { broadcastUrl, accessToken };
}

function buildYahrzeitMessage(params: {
  siteName: string;
  eventName: string;
  occurrenceDate: string;
  siteUrl: string;
  locale: string;
}): string {
  const locale = normalizeLocale(params.locale);

  if (locale === 'he') {
    return [
      `${params.siteName} - הודעת יארצייט`,
      `היום מציינים את היארצייט של ${params.eventName} (${params.occurrenceDate}).`,
      'יהי זכרם ברוך.',
      `עוד באתר: ${params.siteUrl}`,
    ].join('\n');
  }

  if (locale === 'tr') {
    return [
      `${params.siteName} - yahrzeit bildirimi`,
      `${params.eventName} için bugün yahrzeit günü (${params.occurrenceDate}).`,
      'Anısı daima yaşayacak.',
      `Daha fazlası: ${params.siteUrl}`,
    ].join('\n');
  }

  return [
    `${params.siteName} - yahrzeit notice`,
    `Today marks the yahrzeit of ${params.eventName} (${params.occurrenceDate}).`,
    'May their memory be a blessing.',
    `See more: ${params.siteUrl}`,
  ].join('\n');
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class WhatsAppService {
  static validateConfiguration(): void {
    getConfig();
  }

  static buildYahrzeitMessage(params: {
    siteName: string;
    eventName: string;
    occurrenceDate: string;
    siteUrl: string;
    locale: string;
  }): string {
    return buildYahrzeitMessage(params);
  }

  static async sendYahrzeitBroadcast(params: SendYahrzeitBroadcastParams): Promise<void> {
    const config = getConfig();
    const message = buildYahrzeitMessage({
      siteName: params.siteName,
      eventName: params.eventName,
      occurrenceDate: params.occurrenceDate,
      siteUrl: params.siteUrl,
      locale: params.locale,
    });

    const payload: WhatsAppBroadcastPayload = {
      siteId: params.siteId,
      siteName: params.siteName,
      eventId: params.eventId,
      eventName: params.eventName,
      occurrenceDate: params.occurrenceDate,
      siteUrl: params.siteUrl,
      locale: params.locale,
      year: params.year,
      topic: 'yahrzeit',
      message,
    };

    const response = await fetch(config.broadcastUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responsePayload = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(
        `[WhatsAppService] failed to send yahrzeit broadcast: ${response.status} ${JSON.stringify(responsePayload)}`,
      );
    }
  }
}
