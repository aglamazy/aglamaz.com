// Uses plain fetch — no Resend SDK dependency needed.
// Sending is gated on RESEND_API_KEY; missing key → log + no-op, never throws.

import { renderEmailHtml, escapeHtml } from './emailTemplates';
import type { AnniversaryType } from '@/entities/Anniversary';

export type ReminderTopic = 'birthday' | 'yahrzeit' | 'tag';

export type TaggedContentType = 'blessing' | 'photo' | 'post';

export interface InDayEventItem {
  eventId: string;
  type: AnniversaryType;
  eventName: string;
  imageUrl?: string;
  /** Wedding events only - years since the marriage, for "N years of marriage" copy. */
  yearsMarried?: number;
  /** Public memorial page link, resolved by the caller (only set when a public page exists). Falls back to calendarUrl when absent. */
  memorialUrl?: string;
}

export interface InDayReminderEmailParams {
  firstName: string;
  /** Today's occurrences for this member's family calendar - at least one. */
  events: InDayEventItem[];
  /** Link into the app calendar - used for the row links and the CTA button. */
  calendarUrl: string;
  /** Signed link for reminder preference management. */
  manageLink: string;
  lang?: string;
  dir?: 'ltr' | 'rtl';
  siteName?: string;
}

export interface TagNotificationEmailParams {
  firstName: string;
  /** Name of the member who tagged the recipient */
  taggedByName: string;
  contentType: TaggedContentType;
  /** Direct link to the tagged content */
  contentLink: string;
  /** Representative photo for the tagged content (the photo itself, the honoree/event photo, or the post's first image) - omitted when none is resolvable. */
  imageUrl?: string;
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
          subject: `🕯️ תזכורת יום פטירה — ${eventName}`,
          greeting: `שלום ${firstName},`,
          body: `היום הוא יום הפטירה של ${eventName} (${occurrenceDate}). יהי זכרם ברוך.`,
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

interface InDayLocalizedStrings {
  subjectSingle: (eventName: string) => string;
  subjectMultiple: (count: number) => string;
  greeting: string;
  intro: string;
  calendarButtonLabel: string;
  manageFooter: string;
}

type InDayEventLineFn = (name: string) => string;

const IN_DAY_EVENT_VERB: Record<Exclude<AnniversaryType, 'wedding'>, Record<string, InDayEventLineFn>> = {
  birthday: {
    en: (name) => `🎂 Today is ${name}'s birthday`,
    he: (name) => `🎂 היום יום ההולדת של ${name}`,
    tr: (name) => `🎂 Bugün ${name}'in doğum günü`,
  },
  death: {
    en: (name) => `🕯️ Today marks the yahrzeit of ${name}`,
    he: (name) => `🕯️ היום יום פטירה של ${name}`,
    tr: (name) => `🕯️ Bugün ${name}'in yahrzeiti`,
  },
  other: {
    en: (name) => `📌 Today: ${name}`,
    he: (name) => `📌 היום: ${name}`,
    tr: (name) => `📌 Bugün: ${name}`,
  },
};

/** Hebrew has irregular year-count nouns (1 = "שנה אחת", 2 = "שנתיים", 3+ = "N שנים"). */
function hebrewYearsPhrase(years: number): string {
  if (years === 1) return 'שנה אחת';
  if (years === 2) return 'שנתיים';
  return `${years} שנים`;
}

/**
 * Wedding events are a COUPLE's occasion - `name` already holds both partners (e.g.
 * "Dan & Mira", the only field the data model has - see AnniversaryEvent.name). Deliberately
 * does not reuse the individual-possessive "Today is X's ..." pattern the birthday/death
 * branches use above; per family-digest-formats-spec.md's open question on wedding tone.
 */
const WEDDING_EVENT_LINE: Record<string, (name: string, years?: number) => string> = {
  en: (name, years) =>
    years && years > 0
      ? `💍 ${name} are celebrating ${years} year${years === 1 ? '' : 's'} of marriage today`
      : `💍 ${name} are celebrating their wedding anniversary today`,
  he: (name, years) =>
    years && years > 0
      ? `💍 ${name} חוגגים היום ${hebrewYearsPhrase(years)} לנישואיהם`
      : `💍 ${name} חוגגים היום את יום נישואיהם`,
  tr: (name, years) =>
    years && years > 0
      ? `💍 ${name} bugün ${years}. evlilik yıldönümlerini kutluyor`
      : `💍 ${name} bugün evlilik yıldönümlerini kutluyor`,
};

function getInDayEventLine(type: AnniversaryType, eventName: string, lang: string, yearsMarried?: number): string {
  if (type === 'wedding') {
    const fn = WEDDING_EVENT_LINE[lang] ?? WEDDING_EVENT_LINE.en;
    return fn(eventName, yearsMarried);
  }
  const byLang = IN_DAY_EVENT_VERB[type] ?? IN_DAY_EVENT_VERB.other;
  const fn = byLang[lang] ?? byLang.en;
  return fn(eventName);
}

function getInDayLocalizedStrings(lang: string, manageLink: string): InDayLocalizedStrings {
  if (lang === 'he') {
    return {
      subjectSingle: (eventName: string) => `היום: ${eventName}`,
      subjectMultiple: (count: number) => `היום: ${count} אירועים`,
      greeting: 'שלום',
      intro: 'משהו קורה היום בלוח השנה המשפחתי שלך:',
      calendarButtonLabel: 'פתח/י את לוח השנה',
      manageFooter: `<a href="${manageLink}">נהל/י העדפות תזכורות</a>`,
    };
  }

  if (lang === 'tr') {
    return {
      subjectSingle: (eventName: string) => `Bugün: ${eventName}`,
      subjectMultiple: (count: number) => `Bugün: ${count} etkinlik`,
      greeting: 'Merhaba',
      intro: 'Aile takviminde bugün bir şeyler oluyor:',
      calendarButtonLabel: 'Takvimi Aç',
      manageFooter: `<a href="${manageLink}">Hatırlatıcı tercihlerini yönet</a>`,
    };
  }

  return {
    subjectSingle: (eventName: string) => `Today: ${eventName}`,
    subjectMultiple: (count: number) => `Today: ${count} events`,
    greeting: 'Hi',
    intro: "Something's happening today on your family calendar:",
    calendarButtonLabel: 'Open Calendar',
    manageFooter: `<a href="${manageLink}">Manage reminder preferences</a>`,
  };
}

/**
 * One clickable row - photo (when present) + inner HTML, both linking to `href`. Shared by
 * the in-day reminder's event rows and the tag notification: embedding a thumbnail does not
 * reduce click-through, it gives recognition/context that makes the click more likely.
 * Falls back to text-only (no <img>) when no photo is resolvable.
 */
function renderClickableThumbnailRow(href: string, imageUrl: string | undefined, altText: string, innerHtml: string): string {
  const photo = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText)}" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-inline-end:12px;" />`
    : '';
  return `<a href="${escapeHtml(href)}" style="display:flex;align-items:center;text-decoration:none;color:inherit;">${photo}<span>${innerHtml}</span></a>`;
}

/**
 * One clickable event row - photo (when present) + name, both linking into the calendar.
 * Per docs/family-digest-formats-spec.md §6: every row shows a photo, everything is clickable,
 * no distinct "warning" styling for memorials (same weight as any other event).
 */
function renderInDayEventRow(event: InDayEventItem, lang: string, calendarUrl: string): string {
  const label = getInDayEventLine(event.type, escapeHtml(event.eventName), lang, event.yearsMarried);
  const href = event.memorialUrl || calendarUrl;
  return renderClickableThumbnailRow(href, event.imageUrl, event.eventName, label);
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
   * Build the subject + rich HTML for the in-day reminder nudge (docs/family-digest-formats-spec.md
   * §2/§6) - one short email covering ALL of today's occurrences for the member's family
   * calendar (never one email per occurrence). Every event row shows a photo (when available)
   * and is clickable, no per-topic visual distinction.
   */
  static buildInDayReminderEmailHtml(params: InDayReminderEmailParams): { subject: string; html: string } {
    const lang = params.lang ?? 'en';
    const dir = params.dir ?? (lang === 'he' ? 'rtl' : 'ltr');
    const heading = params.siteName ? `🌳 ${params.siteName}` : undefined;

    const strings = getInDayLocalizedStrings(lang, params.manageLink);
    const subject =
      params.events.length === 1
        ? strings.subjectSingle(params.events[0].eventName)
        : strings.subjectMultiple(params.events.length);

    const rows = params.events
      .map((event) => renderInDayEventRow(event, lang, params.calendarUrl))
      .join('');

    const html = renderEmailHtml({
      subject,
      lang,
      dir,
      heading,
      greeting: `${strings.greeting} ${params.firstName},`,
      paragraphs: [strings.intro, rows],
      button: { label: strings.calendarButtonLabel, url: params.calendarUrl },
      footerLines: [strings.manageFooter],
    });

    return { subject, html };
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
    const row = renderClickableThumbnailRow(params.contentLink, params.imageUrl, params.taggedByName, strings.body);

    const html = renderEmailHtml({
      subject: strings.subject,
      lang,
      dir,
      heading,
      greeting: strings.greeting,
      paragraphs: [row],
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
