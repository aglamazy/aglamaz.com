import type { ISite } from '@/entities/Site';
import type { AnniversaryEvent, AnniversaryType } from '@/entities/Anniversary';
import type { GalleryPhoto } from '@/repositories/GalleryPhotoRepository';
import type { DigestEventWithPhotos, DigestRangePayload, MonthlyDigestPayload } from './DigestCompilerService';
import { formatHebrewDisplay } from '@/utils/hebrew';
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

/**
 * <bdi> isolates the recipient's name from the surrounding Hebrew paragraph's
 * bidi direction - without it, a Latin-script name (common: many members' stored
 * firstName/displayName come from Google OAuth in Latin characters even on a Hebrew
 * site) embedded in "שלום X," reads confusingly (Agla, 2026-07-21: "this is worst").
 * Also the one place a member-controlled string reaches this HTML unescaped.
 */
function renderGreeting(recipientName: string): string {
  return `שלום <bdi>${escapeHtml(recipientName)}</bdi>,`;
}

/** Plain-text counterpart to renderGreeting - no bdi/escaping, those are HTML-only concerns. */
function plainGreeting(recipientName: string): string {
  return `שלום ${recipientName},`;
}

function formatMonthLabel(month: number, year: number, locale: string): string {
  const date = new Date(year, month, 1);
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, { month: 'long', year: 'numeric' }).format(date);
}

function formatMonthNameOnly(month: number, locale: string): string {
  const date = new Date(2000, month, 1);
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, { month: 'long' }).format(date);
}

function formatMonthRangeLabel(
  startMonth: number,
  startYear: number,
  endMonth: number,
  endYear: number,
  locale: string,
): string {
  if (startMonth === endMonth && startYear === endYear) {
    return formatMonthLabel(startMonth, startYear, locale);
  }
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  const formatter = new Intl.DateTimeFormat(formatterLocale, { month: 'long', year: 'numeric' });
  const formatterWithRange = formatter as Intl.DateTimeFormat & {
    formatRange?: (start: Date, end: Date) => string;
  };
  const start = new Date(startYear, startMonth, 1);
  const end = new Date(endYear, endMonth, 1);
  if (typeof formatterWithRange.formatRange === 'function') {
    return formatterWithRange.formatRange(start, end);
  }
  return `${formatter.format(start)} – ${formatter.format(end)}`;
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

/**
 * Death (יום פטירה) dates always show the Hebrew date alongside the Gregorian one -
 * regardless of the event's own useHebrew flag, since a Hebrew yahrzeit date is always
 * computable and is the meaningful one for this event type (Agla, 2026-07-21). Built
 * from the already-remapped month/day/year (the digest's target-year occurrence, not
 * whatever year the doc happens to store), never from the stored `date` Timestamp
 * directly - see DigestCompilerService's year-remap fix.
 */
function formatEventDate(event: AnniversaryEvent, locale: string): string {
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  const date = new Date(event.year, event.month, event.day);
  const gregorian = new Intl.DateTimeFormat(formatterLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  if (event.type !== 'death') return gregorian;
  const hebrew = formatHebrewDisplay(date);
  return hebrew ? `${gregorian} (${hebrew})` : gregorian;
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

const TYPE_ICON: Record<AnniversaryType, string> = {
  birthday: '🎂',
  wedding: '💍',
  death: '🕯️',
  other: '⭐',
};

/**
 * Same layout algorithm as the app's own ImageGrid component
 * (src/components/media/ImageGrid.module.css: `columns: 2` + `break-inside: avoid`,
 * each image at its own natural aspect ratio) - not a bespoke "1 big + N small" grid.
 * Used for both a single event's photos and the general recent-photos section, per
 * Agla's 2026-07-21 request to use the same real widget everywhere rather than a
 * different one invented for email. CSS columns over table layout here is a deliberate
 * tradeoff - this app's digest is Gmail-verified, not Outlook-targeted.
 */
function renderMasonryCollage(urls: string[], galleryUrl: string): string {
  if (urls.length === 0) return '';
  const items = urls
    .map(
      (u) =>
        `<a href="${escapeHtml(galleryUrl)}" style="display:block;break-inside:avoid;margin:0 0 8px;"><img src="${escapeHtml(u)}" alt="" style="width:100%;height:auto;border-radius:10px;display:block;" /></a>`,
    )
    .join('');
  return `<div style="column-count:2;column-gap:8px;margin-top:10px;">${items}</div>`;
}

function renderGlobalCollage(photos: GalleryPhoto[], galleryUrl: string): string {
  const urls = photos.map((p) => p.imagesWithDimensions?.[0]?.url).filter((u): u is string => !!u);
  return renderMasonryCollage(urls, galleryUrl);
}

/**
 * One event told as a small magazine article - title on top, its own description (when
 * written), and its own images: the app's own multi-photo collage
 * (GalleryPhoto.anniversaryId) when there is one, falling back to the event's single
 * cover image, falling back to a type icon - never both, per Agla's 2026-07-21 request
 * (showing the cover image AND a separate photo row was redundant). Same treatment for
 * every event, past or coming. Title/date link into the calendar; the collage/hero links
 * into the gallery separately (an <a> can't nest inside another <a>).
 */
function renderEventArticle(entry: DigestEventWithPhotos, locale: string, calendarUrl: string): string {
  const { event, photoUrls } = entry;
  const name = formatEventName(escapeHtml(event.name), event.type, locale);
  const dateLabel = escapeHtml(formatEventDate(event, locale));

  // photoUrls always includes event.imageUrl when present (DigestCompilerService folds
  // it in), so the only remaining fallback is the type icon for an event with no
  // picture at all. Links into the calendar (the event's own context), not the general
  // gallery - these are THIS event's photos, not a browse-everything link (Agla, 2026-07-21).
  const collage = renderMasonryCollage(photoUrls, calendarUrl);
  const visual =
    collage ||
    `<div aria-hidden="true" style="width:100%;height:96px;border-radius:14px;background:#e3ede6;display:flex;align-items:center;justify-content:center;font-size:36px;margin-top:10px;">${TYPE_ICON[event.type]}</div>`;

  const description = event.description?.trim()
    ? `<p style="margin:12px 0 0;color:#3c4a3f;">${escapeHtml(event.description.trim())}</p>`
    : '';

  // Text (title/date/description) reads before the images, not after (Agla, 2026-07-21).
  return `<div style="padding:18px 0;border-bottom:1px solid #e3ede6;"><a href="${escapeHtml(calendarUrl)}" style="text-decoration:none;color:inherit;"><h3 style="font-weight:700;font-size:16px;margin:0;">${name}</h3><div style="font-size:13px;color:#6d7f74;margin-top:2px;">${dateLabel}</div></a>${description}${visual}</div>`;
}

/** A visually separate card for one section ("what was" vs "what's coming") - a shared background tint isn't enough to read as two distinct blocks. */
function renderSectionCard(title: string | null, innerHtml: string, tint: string): string {
  const titleHtml = title ? `<h2 style="font-weight:700;font-size:20px;margin:0 0 4px;">${title}</h2>` : '';
  return `<div style="background:${tint};border-radius:16px;padding:18px 20px;margin:18px 0;">${titleHtml}${innerHtml}</div>`;
}

/** Sub-heading inside a section card, e.g. splitting "coming" into this-month vs next-month. */
function renderSubHeading(text: string): string {
  return `<h2 style="font-size:20px;font-weight:700;margin:16px 0 4px;">${text}</h2>`;
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
  const greeting = renderGreeting(options.recipientName);

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
    plainGreeting(options.recipientName),
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
   * Monthly-cadence digest: a recap of the month just finished (article-style, with each
   * event's own description/photos) and a heads-up on the current + next calendar month
   * (so there's always real forward-looking content, not just whatever's left of "this
   * month"). Per Agla's live-testing corrections 2026-07-21: real calendar-month
   * boundaries (not a rolling window), the coming window needs to reach into next month
   * or it goes empty near month-end, and past events deserve more than a one-line row.
   */
  static buildMonthlyDigestEmail(
    digest: MonthlyDigestPayload,
    options: BuildDigestEmailOptions,
  ): DigestEmailContent {
    const { startMonth, startYear, endMonth, endYear } = digest.comingRange;
    const comingLabel = formatMonthRangeLabel(startMonth, startYear, endMonth, endYear, options.locale);
    const pastLabel = formatMonthLabel(digest.pastMonth.month, digest.pastMonth.year, options.locale);
    const thisMonthName = formatMonthNameOnly(startMonth, options.locale);
    const nextMonthName = formatMonthNameOnly(endMonth, options.locale);

    const eventLine = (entry: DigestEventWithPhotos) => {
      const line = formatEventLine(entry.event, options.locale);
      return entry.event.description?.trim() ? `${line} - ${entry.event.description.trim()}` : line;
    };
    const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));
    const pastArticles = digest.pastEvents
      .map((entry) => renderEventArticle(entry, options.locale, options.calendarUrl))
      .join('');
    const photoCollage = renderGlobalCollage(digest.photos, options.galleryUrl);

    // The "coming" window spans this month + next month - split into two sub-groups
    // under their own h2 so "what's left of this month" and "next month" read as
    // distinct, not one merged list (Agla, 2026-07-21).
    const thisMonthEvents = digest.comingEvents.filter((e) => e.event.month === startMonth && e.event.year === startYear);
    const nextMonthEvents = digest.comingEvents.filter((e) => e.event.month === endMonth && e.event.year === endYear);
    const renderArticles = (entries: DigestEventWithPhotos[]) =>
      entries.map((entry) => renderEventArticle(entry, options.locale, options.calendarUrl)).join('');
    const comingInner = [
      thisMonthEvents.length ? `${renderSubHeading(`אז מה היה לנו בחודש ${thisMonthName}`)}${renderArticles(thisMonthEvents)}` : '',
      nextMonthEvents.length ? `${renderSubHeading(`מה צפוי בחודש ${nextMonthName}`)}${renderArticles(nextMonthEvents)}` : '',
    ].join('');

    const subject = `תקציר חודשי - ${options.siteName} - ${comingLabel}`;
    const greeting = renderGreeting(options.recipientName);

    // Two distinctly tinted cards - "what was" and "what's coming" need to read as
    // clearly separate blocks, not just adjacent headings (Agla, 2026-07-21). No
    // separate intro line - it just repeated what the first section heading already
    // says (Agla, 2026-07-21).
    const paragraphs = [
      digest.pastEvents.length ? renderSectionCard(`מה היה ב${pastLabel}`, pastArticles, '#f7f3ec') : null,
      digest.comingEvents.length ? renderSectionCard(null, comingInner, '#eef5f0') : null,
      digest.photos.length ? `<strong>תמונות אחרונות מהמשפחה</strong><br />${photoCollage}` : null,
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
      plainGreeting(options.recipientName),
      digest.pastEvents.length
        ? [`מה היה ב${pastLabel}:`, ...digest.pastEvents.map((entry) => `• ${eventLine(entry)}`)].join('\n')
        : null,
      thisMonthEvents.length
        ? [`אז מה היה לנו בחודש ${thisMonthName}:`, ...thisMonthEvents.map((entry) => `• ${eventLine(entry)}`)].join('\n')
        : null,
      nextMonthEvents.length
        ? [`מה צפוי בחודש ${nextMonthName}:`, ...nextMonthEvents.map((entry) => `• ${eventLine(entry)}`)].join('\n')
        : null,
      digest.photos.length ? ['תמונות אחרונות מהמשפחה:', ...photoLines.map((l) => `• ${l}`)].join('\n') : null,
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
