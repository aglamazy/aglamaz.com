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
  siteUrl?: string;
}

function formatLocale(locale: string): string {
  return locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
}

function formatMonthLabel(month: number, year: number, locale: string): string {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat(formatLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(formatLocale(locale), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatEventLine(event: DigestPayload['events'][number], locale: string): string {
  const date = new Date(event.year, event.month, event.day);
  return `${event.name} - ${formatDate(date, locale)}`;
}

function formatPhotoLine(photo: DigestPayload['photos'][number], locale: string): string {
  const photoDate = photo.date?.toDate ? photo.date.toDate() : new Date(photo.date as unknown as string);
  const formattedDate = formatDate(photoDate, locale);
  const description = (photo as DigestPayload['photos'][number] & { description?: string }).description;
  if (description && description.trim()) {
    return `${description.trim()} - ${formattedDate}`;
  }
  return formattedDate;
}

const THUMB_SIZE = 48;
const THUMB_BASE_STYLE = `border-radius:8px;display:block;width:${THUMB_SIZE}px;height:${THUMB_SIZE}px;`;
const PLACEHOLDER_HTML = `<div style="${THUMB_BASE_STYLE}background:#eef5f0;"></div>`;

function buildThumb(imageUrl: string | undefined, altText: string): string {
  if (imageUrl) {
    return `<img src="${imageUrl}" width="${THUMB_SIZE}" height="${THUMB_SIZE}" alt="${altText.replace(/"/g, '&quot;')}" style="${THUMB_BASE_STYLE}object-fit:cover;" />`;
  }
  return PLACEHOLDER_HTML;
}

function buildRow(thumbHtml: string, textHtml: string, linkUrl?: string): string {
  const thumbCell = linkUrl
    ? `<a href="${linkUrl}" style="display:block;text-decoration:none;">${thumbHtml}</a>`
    : thumbHtml;
  const textCell = linkUrl
    ? `<a href="${linkUrl}" style="text-decoration:none;color:inherit;">${textHtml}</a>`
    : textHtml;
  return (
    `<table style="margin-bottom:10px;border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0" role="presentation">` +
    `<tr>` +
    `<td style="width:${THUMB_SIZE + 12}px;vertical-align:top;padding-right:12px;">${thumbCell}</td>` +
    `<td style="vertical-align:middle;">${textCell}</td>` +
    `</tr></table>`
  );
}

function buildEventRow(event: DigestPayload['events'][number], locale: string, calendarUrl?: string): string {
  const date = new Date(event.year, event.month, event.day);
  const formattedDate = formatDate(date, locale);
  const thumb = buildThumb(event.imageUrl, event.name);
  const text = `<strong>${event.name}</strong> — ${formattedDate}`;
  return buildRow(thumb, text, calendarUrl);
}

function buildPhotoRow(photo: DigestPayload['photos'][number], locale: string, photosUrl?: string): string {
  const photoDate = photo.date?.toDate ? photo.date.toDate() : new Date(photo.date as unknown as string);
  const formattedDate = formatDate(photoDate, locale);
  const description = (photo as DigestPayload['photos'][number] & { description?: string }).description?.trim();
  const imageUrl = photo.imagesWithDimensions?.[0]?.url;
  const thumb = buildThumb(imageUrl, description || '');
  const text = description ? `${description} — ${formattedDate}` : formattedDate;
  return buildRow(thumb, text, photosUrl);
}

export class DigestTemplateService {
  static buildMonthlyDigestEmail(
    digest: DigestPayload,
    options: BuildDigestEmailOptions,
  ): DigestEmailContent {
    const monthLabel = formatMonthLabel(digest.month, digest.year, options.locale);
    const calendarUrl = options.siteUrl ? `${options.siteUrl}/app/calendar` : undefined;
    const photosUrl = options.siteUrl ? `${options.siteUrl}/app/photos` : undefined;

    const summaryLine = `${digest.events.length} אירועים ו-${digest.photos.length} תמונות אחרונות`;
    const subject = `תקציר חודשי - ${options.siteName} - ${monthLabel}`;

    const paragraphs = [
      `הנה התקציר החודשי עבור ${options.siteName} לחודש ${monthLabel}.`,
      `סיכום: ${summaryLine}.`,
    ];

    const contentBlocks: string[] = [];

    if (digest.events.length) {
      const rows = digest.events
        .map((event) => buildEventRow(event, options.locale, calendarUrl))
        .join('\n');
      contentBlocks.push(`<p>אירועים:</p>\n${rows}`);
    } else {
      paragraphs.push('אירועים: אין החודש.');
    }

    if (digest.photos.length) {
      const rows = digest.photos
        .map((photo) => buildPhotoRow(photo, options.locale, photosUrl))
        .join('\n');
      contentBlocks.push(`<p>תמונות אחרונות:</p>\n${rows}`);
    } else {
      paragraphs.push('תמונות אחרונות: אין החודש.');
    }

    const html = renderEmailHtml({
      subject,
      lang: options.locale,
      dir: options.locale === 'he' ? 'rtl' : 'ltr',
      heading: `🌳 ${options.siteName}`,
      preheader: subject,
      greeting: `שלום ${options.siteName},`,
      paragraphs,
      contentBlocks,
      footerLines: ['תקציר זה נוצר באופן אוטומטי.'],
    });

    const eventLines = digest.events.map((event) => formatEventLine(event, options.locale));
    const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));

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
