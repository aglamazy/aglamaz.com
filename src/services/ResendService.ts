// Uses plain fetch — no Resend SDK dependency needed.
// Sending is gated on RESEND_API_KEY; missing key → log + no-op, never throws.

import { renderEmailHtml } from './emailTemplates';

export type ReminderTopic = 'birthday' | 'yahrzeit' | 'tag';

export type TaggedContentType = 'blessing' | 'photo' | 'post';

export interface TagNotificationEmailParams {
  firstName: string;
  /** Name of the member who tagged the recipient */
  taggedByName: string;
  contentType: TaggedContentType;
  /** Direct link to the tagged content */
  contentLink: string;
  lang?: string;
  dir?: 'ltr' | 'rtl';
  siteName?: string;
}

export interface ReminderEmailParams {
  topic: ReminderTopic;
  firstName: string;
  /** Name of the person whose birthday/yahrzeit it is */
  eventName: string;
  /** Human-readable date string, e.g. "July 15" or "ט״ו תמוז" */
  occurrenceDate: string;
  /** Signed link for reminder preference management */
  manageLink: string;
  /** Optional direct link to the app calendar */
  calendarUrl?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl';
  siteName?: string;
}

export interface TransactionalEmailParams {
  to: string;
  subject: string;
  html: string;
  lang?: string;
}

interface LocalizedStrings {
  subject: string;
  greeting: string;
  body: string;
  calendarButtonLabel: string;
  manageFooter: string;
}

function getLocalizedStrings(
  topic: ReminderTopic,
  firstName: string,
  eventName: string,
  occurrenceDate: string,
  lang: string,
  manageLink: string,
): LocalizedStrings {
  if (lang === 'he') {
    return topic === 'birthday'
      ? {
          subject: `🎂 תזכורת יום הולדת — ${eventName}`,
          greeting: `שלום ${firstName},`,
          body: `היום הוא יום ההולדת של ${eventName} (${occurrenceDate}). אל תשכח/י לאחל מזל טוב!`,
          calendarButtonLabel: 'פתח/י את לוח השנה',
          manageFooter: `<a href="${manageLink}">נהל/י העדפות תזכורות</a>`,
        }
      : {
          subject: `🕯️ תזכורת יארצייט — ${eventName}`,
          greeting: `שלום ${firstName},`,
          body: `היום הוא יארצייט של ${eventName} (${occurrenceDate}). יהי זכרם ברוך.`,
          calendarButtonLabel: 'פתח/י את לוח השנה',
          manageFooter: `<a href="${manageLink}">נהל/י העדפות תזכורות</a>`,
        };
  }

  if (lang === 'tr') {
    return topic === 'birthday'
      ? {
          subject: `🎂 Doğum günü hatırlatıcısı — ${eventName}`,
          greeting: `Merhaba ${firstName},`,
          body: `Bugün ${eventName}'in doğum günü (${occurrenceDate}). Tebrik etmeyi unutmayın!`,
          calendarButtonLabel: 'Takvimi Aç',
          manageFooter: `<a href="${manageLink}">Hatırlatıcı tercihlerini yönet</a>`,
        }
      : {
          subject: `🕯️ Yahrzeit hatırlatıcısı — ${eventName}`,
          greeting: `Merhaba ${firstName},`,
          body: `Bugün ${eventName}'in yahrzeiti (${occurrenceDate}). Anıları daima yaşayacak.`,
          calendarButtonLabel: 'Takvimi Aç',
          manageFooter: `<a href="${manageLink}">Hatırlatıcı tercihlerini yönet</a>`,
        };
  }

  // Default: English
  return topic === 'birthday'
    ? {
        subject: `🎂 Birthday reminder — ${eventName}`,
        greeting: `Hi ${firstName},`,
        body: `Today is ${eventName}'s birthday (${occurrenceDate}). Don't forget to reach out and wish them well!`,
        calendarButtonLabel: 'Open Calendar',
        manageFooter: `<a href="${manageLink}">Manage reminder preferences</a>`,
      }
    : {
        subject: `🕯️ Yahrzeit reminder — ${eventName}`,
        greeting: `Hi ${firstName},`,
        body: `Today marks the yahrzeit of ${eventName} (${occurrenceDate}). May their memory be a blessing.`,
        calendarButtonLabel: 'Open Calendar',
        manageFooter: `<a href="${manageLink}">Manage reminder preferences</a>`,
      };
}

interface TagLocalizedStrings {
  subject: string;
  greeting: string;
  body: string;
  buttonLabel: string;
}

const CONTENT_TYPE_LABEL: Record<TaggedContentType, Record<string, string>> = {
  blessing: { en: 'a blessing', he: 'ברכה', tr: 'bir tebrik' },
  photo: { en: 'a photo', he: 'תמונה', tr: 'bir fotoğraf' },
  post: { en: 'a post', he: 'פוסט', tr: 'bir gönderi' },
};

function getTagLocalizedStrings(
  contentType: TaggedContentType,
  firstName: string,
  taggedByName: string,
  lang: string,
): TagLocalizedStrings {
  const label = CONTENT_TYPE_LABEL[contentType][lang] ?? CONTENT_TYPE_LABEL[contentType].en;

  if (lang === 'he') {
    return {
      subject: `📌 ${taggedByName} תייג/ה אותך`,
      greeting: `שלום ${firstName},`,
      body: `${taggedByName} תייג/ה אותך ב${label}.`,
      buttonLabel: 'צפייה',
    };
  }

  if (lang === 'tr') {
    return {
      subject: `📌 ${taggedByName} sizi etiketledi`,
      greeting: `Merhaba ${firstName},`,
      body: `${taggedByName} sizi ${label} içinde etiketledi.`,
      buttonLabel: 'Görüntüle',
    };
  }

  return {
    subject: `📌 ${taggedByName} tagged you`,
    greeting: `Hi ${firstName},`,
    body: `${taggedByName} tagged you in ${label}.`,
    buttonLabel: 'View',
  };
}

export class ResendService {
  static isEnabled(): boolean {
    return !!process.env.RESEND_API_KEY;
  }

  /**
   * Build the subject + rich HTML for a birthday or yahrzeit reminder email.
   * Uses the shared renderEmailHtml wrapper which handles RTL/LTR layout automatically.
   */
  static buildReminderEmailHtml(params: ReminderEmailParams): { subject: string; html: string } {
    const lang = params.lang ?? 'en';
    const dir = params.dir ?? (lang === 'he' ? 'rtl' : 'ltr');
    const heading = params.siteName ? `🌳 ${params.siteName}` : undefined;

    const strings = getLocalizedStrings(
      params.topic,
      params.firstName,
      params.eventName,
      params.occurrenceDate,
      lang,
      params.manageLink,
    );

    const html = renderEmailHtml({
      subject: strings.subject,
      lang,
      dir,
      heading,
      greeting: strings.greeting,
      paragraphs: [strings.body],
      button: params.calendarUrl
        ? { label: strings.calendarButtonLabel, url: params.calendarUrl }
        : undefined,
      footerLines: [strings.manageFooter],
    });

    return { subject: strings.subject, html };
  }

  /**
   * Build the subject + rich HTML for a "you were tagged" notification email.
   * Event-triggered (not date-computed) — mirrors buildReminderEmailHtml's shape/wrapper reuse.
   */
  static buildTagNotificationEmailHtml(params: TagNotificationEmailParams): { subject: string; html: string } {
    const lang = params.lang ?? 'en';
    const dir = params.dir ?? (lang === 'he' ? 'rtl' : 'ltr');
    const heading = params.siteName ? `🌳 ${params.siteName}` : undefined;

    const strings = getTagLocalizedStrings(params.contentType, params.firstName, params.taggedByName, lang);

    const html = renderEmailHtml({
      subject: strings.subject,
      lang,
      dir,
      heading,
      greeting: strings.greeting,
      paragraphs: [strings.body],
      button: { label: strings.buttonLabel, url: params.contentLink },
    });

    return { subject: strings.subject, html };
  }

  /**
   * Send a transactional email via the Resend REST API.
   * No-ops silently when RESEND_API_KEY is absent — safe for local dev.
   * From address: RESEND_FROM_EMAIL env var, defaulting to reminders@mail.famcircle.org
   * (the verified sending domain provisioned for this project).
   */
  static async sendTransactionalEmail(params: TransactionalEmailParams): Promise<void> {
    if (!ResendService.isEnabled()) {
      console.log('[ResendService] RESEND_API_KEY not configured — skipping email to', params.to);
      return;
    }

    const apiKey = process.env.RESEND_API_KEY!;
    const from =
      process.env.RESEND_FROM_EMAIL ?? 'FamCircle <reminders@mail.famcircle.org>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[ResendService] Resend API error ${response.status}: ${errorText}`);
    }
  }
}

export const resendService = ResendService;
