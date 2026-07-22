import type { AnniversaryType } from '@/entities/Anniversary';
import { renderEmailHtml, escapeHtml } from './emailTemplates';

export interface HonoreeInviteEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface BuildHonoreeInviteEmailOptions {
  locale: string;
  siteName: string;
  /** The event's honoree - who this email is addressed to. */
  honoreeName: string;
  /** Who wrote the event/entered this email - the message is framed as coming from them. */
  authorName: string;
  eventType: AnniversaryType;
  /** No-login, read-only, 48h-expiring magic link to the honoree's blessing page (Agla, 2026-07-22) - not an account-creating invite. */
  blessingLinkUrl: string;
}

const OCCASION_LABEL: Record<AnniversaryType, Record<string, string>> = {
  birthday: { he: 'ליום ההולדת שלך', en: 'for your birthday', tr: 'doğum günün için' },
  wedding: { he: 'ליום הנישואים שלך', en: 'for your anniversary', tr: 'yıl dönümün için' },
  other: { he: '', en: '', tr: '' },
  death: { he: 'לזכרו', en: 'in memory', tr: 'anısına' },
};

/** Empty for 'other' - "ברכות לך" would double up on the sentence's own "כתבו לך", not a real occasion phrase to append. */
function occasionLabel(eventType: AnniversaryType, locale: string): string {
  const byType = OCCASION_LABEL[eventType] ?? OCCASION_LABEL.other;
  return byType[locale] ?? byType.he;
}

export function buildHonoreeInviteEmail(options: BuildHonoreeInviteEmailOptions): HonoreeInviteEmailContent {
  const { locale, siteName, honoreeName, authorName, eventType, blessingLinkUrl } = options;
  const occasion = occasionLabel(eventType, locale);
  const occasionSuffix = occasion ? ` ${occasion}` : '';

  const subject = `✨ המשפחה כתבה לך ברכות${occasionSuffix} ב${siteName}`;
  const greeting = `שלום <bdi>${escapeHtml(honoreeName)}</bdi>,`;
  const bodyParagraph = `<bdi>${escapeHtml(authorName)}</bdi> ובני המשפחה כתבו לך ברכות${occasionSuffix} ב${escapeHtml(siteName)} - אתר המשפחה הפרטי שלכם.`;
  // Read-only magic link, not an account invite (Agla, 2026-07-22) - no "join"/"reply" language.
  const linkParagraph = 'לחצו כדי לקרוא את הברכות שכתבו לכם. הקישור בתוקף ל-48 שעות.';

  const html = renderEmailHtml({
    subject,
    lang: locale,
    dir: locale === 'he' ? 'rtl' : 'ltr',
    heading: `🌳 ${siteName}`,
    preheader: subject,
    greeting,
    paragraphs: [bodyParagraph, linkParagraph],
    button: { label: 'קרא/י את הברכות שלך', url: blessingLinkUrl },
    footerLines: ['נשלח אליך על ידי בן/בת משפחה שרוצים לשתף איתך רגע חם.'],
  });

  const text = [
    `שלום ${honoreeName},`,
    `${authorName} ובני המשפחה כתבו לך ברכות${occasionSuffix} ב${siteName} - אתר המשפחה הפרטי שלכם.`,
    linkParagraph,
    blessingLinkUrl,
  ].join('\n\n');

  return { subject, html, text };
}
