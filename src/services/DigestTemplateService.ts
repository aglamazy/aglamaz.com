import type { ISite } from '@/entities/Site';
import type { DigestPayload } from './DigestCompilerService';
import { getLocalizedFields } from './LocalizationService.client';
import { renderEmailHtml } from './emailTemplates';

export interface DigestEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface BuildDigestEmailOptions {
  locale: string;
  siteName: string;
}

function formatMonthLabel(month: number, year: number, locale: string): string {
  const date = new Date(year, month, 1);
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatEventLine(event: DigestPayload['events'][number], locale: string): string {
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  const date = new Date(event.year, event.month, event.day);
  const formattedDate = new Intl.DateTimeFormat(formatterLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  return `${event.name} - ${formattedDate}`;
}

function formatPhotoLine(photo: DigestPayload['photos'][number], locale: string): string {
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  const photoDate = photo.date?.toDate ? photo.date.toDate() : new Date(photo.date as unknown as string);
  const formattedDate = new Intl.DateTimeFormat(formatterLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(photoDate);
  const description = (photo as DigestPayload['photos'][number] & { description?: string }).description;
  if (description && description.trim()) {
    return `${description.trim()} - ${formattedDate}`;
  }
  return `${formattedDate}`;
}

function joinLines(lines: string[]): string {
  return lines.map((line) => `• ${line}`).join('<br />');
}

export class DigestTemplateService {
  static buildMonthlyDigestEmail(
    digest: DigestPayload,
    options: BuildDigestEmailOptions,
  ): DigestEmailContent {
    const monthLabel = formatMonthLabel(digest.month, digest.year, options.locale);
    const eventLines = digest.events.map((event) => formatEventLine(event, options.locale));
    const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));

    const summaryLine = `${digest.events.length} אירועים ו-${digest.photos.length} תמונות אחרונות`;
    const subject = `תקציר חודשי - ${options.siteName} - ${monthLabel}`;

    const paragraphs = [
      `הנה התקציר החודשי עבור ${options.siteName} לחודש ${monthLabel}.`,
      `סיכום: ${summaryLine}.`,
      digest.events.length
        ? `אירועים:<br />${joinLines(eventLines)}`
        : 'אירועים: אין החודש.',
      digest.photos.length
        ? `תמונות אחרונות:<br />${joinLines(photoLines)}`
        : 'תמונות אחרונות: אין החודש.',
    ];

    const html = renderEmailHtml({
      subject,
      lang: options.locale,
      dir: options.locale === 'he' ? 'rtl' : 'ltr',
      heading: `🌳 ${options.siteName}`,
      preheader: subject,
      greeting: `שלום ${options.siteName},`,
      paragraphs,
      footerLines: ['תקציר זה נוצר באופן אוטומטי.'],
    });

    const textSections = [
      `שלום ${options.siteName},`,
      `הנה התקציר החודשי עבור ${options.siteName} לחודש ${monthLabel}.`,
      `סיכום: ${summaryLine}.`,
      digest.events.length
        ? ['אירועים:', ...eventLines.map((line) => `• ${line}`)].join('\n')
        : 'אירועים: אין החודש.',
      digest.photos.length
        ? ['תמונות אחרונות:', ...photoLines.map((line) => `• ${line}`)].join('\n')
        : 'תמונות אחרונות: אין החודש.',
      'תקציר זה נוצר באופן אוטומטי.',
    ];
    const text = textSections.join('\n\n');

    return { subject, html, text };
  }
}

export function resolveDigestSiteName(site: ISite, locale: string, siteId: string): string {
  const localizedName = getLocalizedFields(site, locale, ['name']).name?.trim();
  if (localizedName) {
    return localizedName;
  }

  if (site.name?.trim()) {
    return site.name.trim();
  }

  return siteId;
}
