import type { ISite } from '@/entities/Site';
import type { AnniversaryEvent, AnniversaryType } from '@/entities/Anniversary';
import type { GalleryPhoto } from '@/repositories/GalleryPhotoRepository';
import type { DigestRangePayload, MonthlyDigestPayload } from './DigestCompilerService';
import { getLocalizedFields } from './LocalizationService.client';
import { renderEmailHtml, escapeHtml } from './emailTemplates';

export interface DigestEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface BuildDigestEmailOptions {
  locale: string;
  siteName: string;
  /** The actual recipient's display name - the greeting addresses them, never the site. */
  recipientName: string;
  /** Link into the app calendar - every event row wraps this, per family-digest-formats-spec.md §6. */
  calendarUrl: string;
  /** Link into the app gallery - every photo thumbnail wraps this. */
  galleryUrl: string;
}

const EVENT_THUMB_SIZE = 48;
const PHOTO_THUMB_SIZE = 96;

function formatMonthLabel(month: number, year: number, locale: string): string {
  const date = new Date(year, month, 1);
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, { month: 'long', year: 'numeric' }).format(date);
}

function formatRangeLabel(startDate: Date, endDate: Date, locale: string): string {
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  const formatter = new Intl.DateTimeFormat(formatterLocale, { month: 'long', day: 'numeric', year: 'numeric' });
  const formatterWithRange = formatter as Intl.DateTimeFormat & {
    formatRange?: (start: Date, end: Date) => string;
  };
  if (typeof formatterWithRange.formatRange === 'function') {
    return formatterWithRange.formatRange(startDate, endDate);
  }
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

function formatEventDate(event: AnniversaryEvent, locale: string): string {
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  const date = new Date(event.year, event.month, event.day);
  return new Intl.DateTimeFormat(formatterLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatPhotoDate(photo: GalleryPhoto, locale: string): string {
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  const photoDate = photo.date?.toDate ? photo.date.toDate() : new Date(photo.date as unknown as string);
  return new Intl.DateTimeFormat(formatterLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(photoDate);
}

/**
 * Couple-appropriate label for a wedding-anniversary event - "{name}'s anniversary" rather
 * than the plain "{name}" used for birthday/death, since `name` already holds both names
 * (e.g. "Dan & Mira" - see AnniversaryEvent.name, no separate person1/person2 fields).
 * Per family-digest-formats-spec.md open question on wedding tone: not the individual
 * birthday/yahrzeit phrasing reused verbatim.
 */
const WEDDING_DIGEST_LABEL: Record<string, (name: string) => string> = {
  en: (name) => `${name}'s anniversary`,
  he: (name) => `יום הנישואים של ${name}`,
  tr: (name) => `${name} evlilik yıldönümü`,
};

function formatEventName(name: string, type: AnniversaryType, locale: string): string {
  if (type !== 'wedding') return name;
  const fn = WEDDING_DIGEST_LABEL[locale] ?? WEDDING_DIGEST_LABEL.en;
  return fn(name);
}

function formatEventLine(event: AnniversaryEvent, locale: string): string {
  const name = formatEventName(event.name, event.type, locale);
  return `${name} - ${formatEventDate(event, locale)}`;
}

function formatPhotoLine(photo: GalleryPhoto, locale: string): string {
  const formattedDate = formatPhotoDate(photo, locale);
  const description = (photo as GalleryPhoto & { description?: string }).description;
  if (description && description.trim()) {
    return `${description.trim()} - ${formattedDate}`;
  }
  return `${formattedDate}`;
}

/**
 * One clickable event row - thumbnail (real imageUrl, or a placeholder when missing) + name/date,
 * both wrapped in a single anchor into the calendar. Same visual weight for every event type -
 * per family-digest-formats-spec.md §6, memorial (death) events get NO distinct "warning" styling.
 */
function renderEventRow(event: AnniversaryEvent, locale: string, calendarUrl: string): string {
  const name = formatEventName(escapeHtml(event.name), event.type, locale);
  const label = `${name} - ${escapeHtml(formatEventDate(event, locale))}`;
  const thumbnail = event.imageUrl
    ? `<img src="${escapeHtml(event.imageUrl)}" alt="${escapeHtml(event.name)}" width="${EVENT_THUMB_SIZE}" height="${EVENT_THUMB_SIZE}" style="width:${EVENT_THUMB_SIZE}px;height:${EVENT_THUMB_SIZE}px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-inline-end:12px;" />`
    : `<span aria-hidden="true" style="display:inline-block;width:${EVENT_THUMB_SIZE}px;height:${EVENT_THUMB_SIZE}px;line-height:${EVENT_THUMB_SIZE}px;border-radius:50%;background:#e3ede6;color:#295640;text-align:center;font-size:20px;vertical-align:middle;margin-inline-end:12px;">🌳</span>`;
  return `<a href="${escapeHtml(calendarUrl)}" style="display:flex;align-items:center;text-decoration:none;color:inherit;margin:8px 0;">${thumbnail}<span>${label}</span></a>`;
}

/**
 * One clickable photo thumbnail (real imagesWithDimensions[0].url, or a placeholder tile when
 * missing) wrapped in an anchor into the gallery.
 */
function renderPhotoThumbnail(photo: GalleryPhoto, galleryUrl: string): string {
  const url = photo.imagesWithDimensions?.[0]?.url;
  const tile = url
    ? `<img src="${escapeHtml(url)}" alt="" width="${PHOTO_THUMB_SIZE}" height="${PHOTO_THUMB_SIZE}" style="width:${PHOTO_THUMB_SIZE}px;height:${PHOTO_THUMB_SIZE}px;border-radius:8px;object-fit:cover;" />`
    : `<span aria-hidden="true" style="display:inline-block;width:${PHOTO_THUMB_SIZE}px;height:${PHOTO_THUMB_SIZE}px;border-radius:8px;background:#e3ede6;"></span>`;
  return `<a href="${escapeHtml(galleryUrl)}" style="display:inline-block;margin:4px;">${tile}</a>`;
}

function renderPhotoGrid(photos: GalleryPhoto[], galleryUrl: string): string {
  return photos.map((photo) => renderPhotoThumbnail(photo, galleryUrl)).join('');
}

/**
 * Shared render for both cadences - they differ only in subject prefix and the label
 * under it (a specific month vs. a date range); content shape (events + recent photos)
 * and personalization are identical. Greets the actual recipient (options.recipientName),
 * never the site - and omits a section entirely when it has nothing in it, rather than
 * printing an empty-state line (family-digest-formats-spec.md fixes, 2026-07-21).
 */
function buildRangeDigestEmail(
  digest: DigestRangePayload,
  options: BuildDigestEmailOptions,
  subjectPrefix: string,
  periodLabel: string,
  introLine: string,
  eventsHeading: string,
): DigestEmailContent {
  const eventLines = digest.events.map((event) => formatEventLine(event, options.locale));
  const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));
  const eventRows = digest.events
    .map((event) => renderEventRow(event, options.locale, options.calendarUrl))
    .join('');
  const photoGrid = renderPhotoGrid(digest.photos, options.galleryUrl);

  const summaryLine = `${digest.events.length} אירועים ו-${digest.photos.length} תמונות אחרונות`;
  const subject = `${subjectPrefix} - ${options.siteName} - ${periodLabel}`;
  const greeting = `שלום ${options.recipientName},`;

  const paragraphs = [
    introLine,
    `סיכום: ${summaryLine}.`,
    digest.events.length ? `${eventsHeading}:<br />${eventRows}` : null,
    digest.photos.length ? `תמונות אחרונות:<br />${photoGrid}` : null,
  ].filter((p): p is string => p !== null);

  const html = renderEmailHtml({
    subject,
    lang: options.locale,
    dir: options.locale === 'he' ? 'rtl' : 'ltr',
    heading: `🌳 ${options.siteName}`,
    preheader: subject,
    greeting,
    paragraphs,
    footerLines: ['תקציר זה נוצר באופן אוטומטי.'],
  });

  const textSections = [
    greeting,
    introLine,
    `סיכום: ${summaryLine}.`,
    digest.events.length ? [`${eventsHeading}:`, ...eventLines.map((line) => `• ${line}`)].join('\n') : null,
    digest.photos.length ? ['תמונות אחרונות:', ...photoLines.map((line) => `• ${line}`)].join('\n') : null,
    'תקציר זה נוצר באופן אוטומטי.',
  ].filter((s): s is string => s !== null);
  const text = textSections.join('\n\n');

  return { subject, html, text };
}

export class DigestTemplateService {
  /**
   * Monthly-cadence digest - two full calendar months (see MonthlyDigestPayload doc
   * comment): "what happened" (the month just finished) and "what's coming" (the month
   * just starting), each its own section, each omitted independently when empty. Per
   * Agla's live-testing correction 2026-07-21 - a rolling window produced random-looking
   * period boundaries and one-directional content; recipients expect real calendar-month
   * boundaries and both a recap and a heads-up.
   */
  static buildMonthlyDigestEmail(
    digest: MonthlyDigestPayload,
    options: BuildDigestEmailOptions,
  ): DigestEmailContent {
    const comingLabel = formatMonthLabel(digest.comingMonth.month, digest.comingMonth.year, options.locale);
    const pastLabel = formatMonthLabel(digest.pastMonth.month, digest.pastMonth.year, options.locale);

    const pastEventLines = digest.pastEvents.map((event) => formatEventLine(event, options.locale));
    const comingEventLines = digest.comingEvents.map((event) => formatEventLine(event, options.locale));
    const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));
    const pastEventRows = digest.pastEvents.map((event) => renderEventRow(event, options.locale, options.calendarUrl)).join('');
    const comingEventRows = digest.comingEvents
      .map((event) => renderEventRow(event, options.locale, options.calendarUrl))
      .join('');
    const photoGrid = renderPhotoGrid(digest.photos, options.galleryUrl);

    const subject = `תקציר חודשי - ${options.siteName} - ${comingLabel}`;
    const greeting = `שלום ${options.recipientName},`;
    const introLine = `הנה התקציר החודשי עבור ${options.siteName}.`;

    const paragraphs = [
      introLine,
      digest.comingEvents.length ? `אירועים ב${comingLabel}:<br />${comingEventRows}` : null,
      digest.pastEvents.length ? `מה היה ב${pastLabel}:<br />${pastEventRows}` : null,
      digest.photos.length ? `תמונות אחרונות:<br />${photoGrid}` : null,
    ].filter((p): p is string => p !== null);

    const html = renderEmailHtml({
      subject,
      lang: options.locale,
      dir: options.locale === 'he' ? 'rtl' : 'ltr',
      heading: `🌳 ${options.siteName}`,
      preheader: subject,
      greeting,
      paragraphs,
      footerLines: ['תקציר זה נוצר באופן אוטומטי.'],
    });

    const textSections = [
      greeting,
      introLine,
      digest.comingEvents.length ? [`אירועים ב${comingLabel}:`, ...comingEventLines.map((l) => `• ${l}`)].join('\n') : null,
      digest.pastEvents.length ? [`מה היה ב${pastLabel}:`, ...pastEventLines.map((l) => `• ${l}`)].join('\n') : null,
      digest.photos.length ? ['תמונות אחרונות:', ...photoLines.map((l) => `• ${l}`)].join('\n') : null,
      'תקציר זה נוצר באופן אוטומטי.',
    ].filter((s): s is string => s !== null);
    const text = textSections.join('\n\n');

    return { subject, html, text };
  }

  /**
   * Rolling-window variant for weekly-cadence subscribers (family-digest-formats-spec.md §1) -
   * same render as the monthly digest, just a shorter window and different subject prefix.
   */
  static buildWeeklyDigestEmail(
    digest: DigestRangePayload,
    options: BuildDigestEmailOptions,
  ): DigestEmailContent {
    const periodLabel = formatRangeLabel(digest.startDate, digest.endDate, options.locale);
    return buildRangeDigestEmail(
      digest,
      options,
      'תקציר שבועי',
      periodLabel,
      `הנה התקציר השבועי עבור ${options.siteName} - אירועים קרובים ותמונות אחרונות.`,
      'אירועים קרובים',
    );
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
