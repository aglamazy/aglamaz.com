import type { ISite } from '@/entities/Site';
import type { AnniversaryEvent, AnniversaryType } from '@/entities/Anniversary';
import type { GalleryPhoto } from '@/repositories/GalleryPhotoRepository';
import type { CadenceDigestPayload, DigestEventWithPhotos } from './DigestCompilerService';
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

function formatMonthNameOnly(month: number, locale: string): string {
  const date = new Date(2000, month, 1);
  const formatterLocale = locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, { month: 'long' }).format(date);
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

const BIRTHDAY_DIGEST_LABEL: Record<string, (name: string) => string> = {
  en: (name) => `${name}'s birthday`,
  he: (name) => `יום ההולדת של ${name}`,
  tr: (name) => `${name} doğum günü`,
};

/**
 * If the event name is already a full celebration title (e.g. "מסיבת לילה
 * אגלמז!"), it reads fine on its own - only a bare person's name needs
 * "birthday" prepended (Agla, 2026-07-22: an event just named "אורן אגלמז"
 * should auto-add the label, "מסיבת לילה אגלמז!" is fine as-is). Heuristic:
 * skip if the name already contains a celebration/birthday keyword.
 */
const CELEBRATION_KEYWORDS = /מסיב|חגיג|יום.?הולדת|party|celebration|birthday/i;

function formatEventName(name: string, type: AnniversaryType, locale: string): string {
  if (type === 'wedding') {
    const fn = WEDDING_DIGEST_LABEL[locale] ?? WEDDING_DIGEST_LABEL.en;
    return fn(name);
  }
  if (type === 'birthday' && !CELEBRATION_KEYWORDS.test(name)) {
    const fn = BIRTHDAY_DIGEST_LABEL[locale] ?? BIRTHDAY_DIGEST_LABEL.en;
    return fn(name);
  }
  return name;
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
function renderEventArticle(entry: DigestEventWithPhotos, locale: string, calendarUrl: string, showBlessingLink: boolean): string {
  const { event, photoUrls, blessingPageSlug } = entry;
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

  // Only upcoming events invite writing a blessing (Agla, 2026-07-22) - a past event's
  // occasion has already happened. Same member-authed page the calendar already uses,
  // just a direct link into the write flow instead of into the calendar month view.
  const blessingLink =
    showBlessingLink && blessingPageSlug
      ? `<div style="margin-top:10px;"><a href="${escapeHtml(new URL(calendarUrl).origin)}/app/blessing/${escapeHtml(blessingPageSlug)}" style="font-size:14px;font-weight:600;color:#2f6f4d;text-decoration:none;">✍️ כתבו ברכה</a></div>`
      : '';

  // Text (title/date/description) reads before the images, not after (Agla, 2026-07-21).
  return `<div style="padding:18px 0;border-bottom:1px solid #e3ede6;"><a href="${escapeHtml(calendarUrl)}" style="text-decoration:none;color:inherit;"><h3 style="font-weight:700;font-size:16px;margin:0;">${name}</h3><div style="font-size:13px;color:#6d7f74;margin-top:2px;">${dateLabel}</div></a>${description}${visual}${blessingLink}</div>`;
}

/** A visually separate card for one section ("what was" vs "what's coming") - a shared background tint isn't enough to read as two distinct blocks. */
function renderSectionCard(title: string | null, innerHtml: string, tint: string): string {
  const titleHtml = title ? `<h2 style="font-weight:700;font-size:20px;margin:0 0 4px;">${title}</h2>` : '';
  return `<div style="background:${tint};border-radius:16px;padding:18px 20px;margin:18px 0;">${titleHtml}${innerHtml}</div>`;
}

/** Sub-heading inside a section card, e.g. splitting "coming" events by the calendar month each falls in. */
function renderSubHeading(text: string): string {
  return `<h2 style="font-size:20px;font-weight:700;margin:16px 0 4px;">${text}</h2>`;
}

interface MonthGroup {
  month: number;
  year: number;
  entries: DigestEventWithPhotos[];
}

/**
 * Splits a chronologically-sorted event list into groups by calendar month - a coming
 * window (1-2 months forward, whichever cadence) reads as one heading per real month
 * touched, not one merged list, regardless of how many months it happens to span
 * (Agla, 2026-07-21 - this generalizes what was originally a monthly-only "this
 * month/next month" split so weekly gets identical treatment for free).
 */
function groupEventsByMonth(entries: DigestEventWithPhotos[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.month === entry.event.month && last.year === entry.event.year) {
      last.entries.push(entry);
    } else {
      groups.push({ month: entry.event.month, year: entry.event.year, entries: [entry] });
    }
  }
  return groups;
}

function eventLineWithDescription(entry: DigestEventWithPhotos, locale: string): string {
  const line = formatEventLine(entry.event, locale);
  return entry.event.description?.trim() ? `${line} - ${entry.event.description.trim()}` : line;
}

/**
 * The one real render path every cadence shares - see CadenceDigestPayload doc comment
 * in DigestCompilerService. Only subjectPrefix ('תקציר חודשי' | 'תקציר שבועי') differs
 * between cadences; everything else - section cards, per-event articles, month-grouped
 * coming headings, photo collage, bidi-safe greeting - is one shared implementation
 * (Agla, 2026-07-21 DRY correction).
 */
function buildCadenceDigestEmail(
  digest: CadenceDigestPayload,
  options: BuildDigestEmailOptions,
  subjectPrefix: string,
): DigestEmailContent {
  const pastLabel = formatRangeLabel(digest.pastRange.startDate, digest.pastRange.endDate, options.locale);
  const comingLabel = formatRangeLabel(digest.comingRange.startDate, digest.comingRange.endDate, options.locale);
  const comingGroups = groupEventsByMonth(digest.comingEvents);

  const renderArticles = (entries: DigestEventWithPhotos[], showBlessingLink: boolean) =>
    entries.map((entry) => renderEventArticle(entry, options.locale, options.calendarUrl, showBlessingLink)).join('');

  const pastArticles = renderArticles(digest.pastEvents, false);
  const comingInner = comingGroups
    .map((group) => renderSubHeading(`אירועים ב${formatMonthNameOnly(group.month, options.locale)}`) + renderArticles(group.entries, true))
    .join('');
  const photoCollage = renderGlobalCollage(digest.photos, options.galleryUrl);

  const subject = `${subjectPrefix} - ${options.siteName} - ${comingLabel}`;
  const greeting = renderGreeting(options.recipientName);

  // Two distinctly tinted cards - "what was" and "what's coming" need to read as
  // clearly separate blocks, not just adjacent headings (Agla, 2026-07-21).
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

  const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));
  const textSections = [
    plainGreeting(options.recipientName),
    digest.pastEvents.length
      ? [`מה היה ב${pastLabel}:`, ...digest.pastEvents.map((entry) => `• ${eventLineWithDescription(entry, options.locale)}`)].join('\n')
      : null,
    ...comingGroups.map((group) =>
      [
        `אירועים ב${formatMonthNameOnly(group.month, options.locale)}:`,
        ...group.entries.map((entry) => `• ${eventLineWithDescription(entry, options.locale)}`),
      ].join('\n'),
    ),
    digest.photos.length ? ['תמונות אחרונות מהמשפחה:', ...photoLines.map((l) => `• ${l}`)].join('\n') : null,
    'תקציר זה נוצר באופן אוטומטי.',
  ].filter((s): s is string => s !== null);
  const text = textSections.join('\n\n');

  return { subject, html, text };
}

export class DigestTemplateService {
  /**
   * Monthly-cadence digest: a recap of the month just finished (article-style, with each
   * event's own description/photos) and a heads-up on the current + next calendar month.
   * Per Agla's live-testing corrections 2026-07-21: real calendar-month boundaries (not
   * a rolling window), the coming window needs to reach into next month or it goes empty
   * near month-end, and past events deserve more than a one-line row.
   */
  static buildMonthlyDigestEmail(digest: CadenceDigestPayload, options: BuildDigestEmailOptions): DigestEmailContent {
    return buildCadenceDigestEmail(digest, options, 'תקציר חודשי');
  }

  /**
   * Weekly-cadence digest: same article-style treatment as monthly (Agla, 2026-07-21:
   * "Basically it should be more like the monthly") - the compiler gives it a rolling
   * 1-week-back / 1-month-forward window instead of calendar-month boundaries, but the
   * rendering is the exact same shared path.
   */
  static buildWeeklyDigestEmail(digest: CadenceDigestPayload, options: BuildDigestEmailOptions): DigestEmailContent {
    return buildCadenceDigestEmail(digest, options, 'תקציר שבועי');
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
