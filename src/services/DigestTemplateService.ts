import type { ISite } from '@/entities/Site';
import type { DigestPayload, DigestWindowEvent, DigestWindowPayload } from './DigestCompilerService';
import type { GalleryPhoto } from '@/repositories/GalleryPhotoRepository';
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

function formatterLocaleFor(locale: string): string {
  return locale === 'he' ? 'he-IL' : locale === 'tr' ? 'tr-TR' : 'en-US';
}

function formatMonthLabel(month: number, year: number, locale: string): string {
  const date = new Date(year, month, 1);
  return new Intl.DateTimeFormat(formatterLocaleFor(locale), {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatWindowLabel(startDate: Date, endDate: Date, locale: string): string {
  const fmt = new Intl.DateTimeFormat(formatterLocaleFor(locale), { month: 'long', day: 'numeric' });
  return `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
}

function formatMonthlyEventLine(event: DigestPayload['events'][number], locale: string): string {
  const date = new Date(event.year, event.month, event.day);
  const formattedDate = new Intl.DateTimeFormat(formatterLocaleFor(locale), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  return `${event.name} - ${formattedDate}`;
}

function formatWindowEventLine(event: DigestWindowEvent, locale: string): string {
  const formattedDate = new Intl.DateTimeFormat(formatterLocaleFor(locale), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(event.occurrenceDate);
  return `${event.name} - ${formattedDate}`;
}

function formatPhotoLine(photo: GalleryPhoto, locale: string): string {
  const photoDate = photo.date?.toDate ? photo.date.toDate() : new Date(photo.date as unknown as string);
  const formattedDate = new Intl.DateTimeFormat(formatterLocaleFor(locale), {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(photoDate);
  const description = (photo as GalleryPhoto & { description?: string }).description;
  if (description && description.trim()) {
    return `${description.trim()} - ${formattedDate}`;
  }
  return `${formattedDate}`;
}

function joinLines(lines: string[]): string {
  return lines.map((line) => `• ${line}`).join('<br />');
}

/**
 * The digest content (subject/events/photos) is compiled and rendered ONCE per
 * (site, cadence, locale) group, but the manage-preferences link is signed per-member. Rather
 * than re-render the whole email per recipient, the manage link is a placeholder swapped in per
 * member via replaceManageLink - a cheap string substitution, not a re-render.
 */
export const MANAGE_LINK_PLACEHOLDER = '__DIGEST_MANAGE_LINK__';

export function replaceManageLink(content: DigestEmailContent, manageLink: string): DigestEmailContent {
  return {
    subject: content.subject,
    html: content.html.split(MANAGE_LINK_PLACEHOLDER).join(manageLink),
    text: content.text.split(MANAGE_LINK_PLACEHOLDER).join(manageLink),
  };
}

interface DigestLocalizedStrings {
  subject: (periodLabel: string) => string;
  greeting: string;
  intro: (periodLabel: string) => string;
  summary: (eventsCount: number, photosCount: number) => string;
  eventsHeading: string;
  noEvents: string;
  photosHeading: string;
  noPhotos: string;
  footer: string;
  manageFooterLabel: string;
}

function getDigestLocalizedStrings(cadence: 'weekly' | 'monthly', lang: string): DigestLocalizedStrings {
  if (lang === 'he') {
    return cadence === 'weekly'
      ? {
          subject: (periodLabel) => `תקציר שבועי - ${periodLabel}`,
          greeting: 'שלום,',
          intro: (periodLabel) => `הנה מה שמתקרב בטווח הקרוב (${periodLabel}).`,
          summary: (eventsCount, photosCount) => `סיכום: ${eventsCount} אירועים ו-${photosCount} תמונות אחרונות.`,
          eventsHeading: 'אירועים קרובים:',
          noEvents: 'אין אירועים קרובים.',
          photosHeading: 'תמונות אחרונות:',
          noPhotos: 'אין תמונות חדשות.',
          footer: 'תקציר זה נוצר באופן אוטומטי.',
          manageFooterLabel: 'נהל/י העדפות תקציר',
        }
      : {
          subject: (periodLabel) => `תקציר חודשי - ${periodLabel}`,
          greeting: 'שלום,',
          intro: (periodLabel) => `הנה התקציר החודשי לחודש ${periodLabel}.`,
          summary: (eventsCount, photosCount) => `סיכום: ${eventsCount} אירועים ו-${photosCount} תמונות אחרונות.`,
          eventsHeading: 'אירועים:',
          noEvents: 'אין אירועים החודש.',
          photosHeading: 'תמונות אחרונות:',
          noPhotos: 'אין תמונות חדשות החודש.',
          footer: 'תקציר זה נוצר באופן אוטומטי.',
          manageFooterLabel: 'נהל/י העדפות תקציר',
        };
  }

  if (lang === 'tr') {
    return cadence === 'weekly'
      ? {
          subject: (periodLabel) => `Haftalık özet - ${periodLabel}`,
          greeting: 'Merhaba,',
          intro: (periodLabel) => `İşte yaklaşan dönem için özetiniz (${periodLabel}).`,
          summary: (eventsCount, photosCount) => `Özet: ${eventsCount} etkinlik ve ${photosCount} yeni fotoğraf.`,
          eventsHeading: 'Yaklaşan etkinlikler:',
          noEvents: 'Yaklaşan etkinlik yok.',
          photosHeading: 'Son fotoğraflar:',
          noPhotos: 'Yeni fotoğraf yok.',
          footer: 'Bu özet otomatik olarak oluşturuldu.',
          manageFooterLabel: 'Özet tercihlerini yönet',
        }
      : {
          subject: (periodLabel) => `Aylık özet - ${periodLabel}`,
          greeting: 'Merhaba,',
          intro: (periodLabel) => `İşte ${periodLabel} ayı için aylık özetiniz.`,
          summary: (eventsCount, photosCount) => `Özet: ${eventsCount} etkinlik ve ${photosCount} yeni fotoğraf.`,
          eventsHeading: 'Etkinlikler:',
          noEvents: 'Bu ay etkinlik yok.',
          photosHeading: 'Son fotoğraflar:',
          noPhotos: 'Bu ay yeni fotoğraf yok.',
          footer: 'Bu özet otomatik olarak oluşturuldu.',
          manageFooterLabel: 'Özet tercihlerini yönet',
        };
  }

  // Default: English
  return cadence === 'weekly'
    ? {
        subject: (periodLabel) => `Weekly digest - ${periodLabel}`,
        greeting: 'Hi,',
        intro: (periodLabel) => `Here's what's coming up (${periodLabel}).`,
        summary: (eventsCount, photosCount) => `Summary: ${eventsCount} events and ${photosCount} recent photos.`,
        eventsHeading: 'Coming up:',
        noEvents: 'Nothing coming up.',
        photosHeading: 'Recent photos:',
        noPhotos: 'No new photos.',
        footer: 'This digest was generated automatically.',
        manageFooterLabel: 'Manage digest preferences',
      }
    : {
        subject: (periodLabel) => `Monthly digest - ${periodLabel}`,
        greeting: 'Hi,',
        intro: (periodLabel) => `Here's your monthly digest for ${periodLabel}.`,
        summary: (eventsCount, photosCount) => `Summary: ${eventsCount} events and ${photosCount} recent photos.`,
        eventsHeading: 'Events:',
        noEvents: 'No events this month.',
        photosHeading: 'Recent photos:',
        noPhotos: 'No new photos this month.',
        footer: 'This digest was generated automatically.',
        manageFooterLabel: 'Manage digest preferences',
      };
}

function buildDigestEmailContent(params: {
  cadence: 'weekly' | 'monthly';
  periodLabel: string;
  eventLines: string[];
  photoLines: string[];
  eventsCount: number;
  photosCount: number;
  options: BuildDigestEmailOptions;
}): DigestEmailContent {
  const { cadence, periodLabel, eventLines, photoLines, eventsCount, photosCount, options } = params;
  const strings = getDigestLocalizedStrings(cadence, options.locale);
  const subject = `${strings.subject(periodLabel)} - ${options.siteName}`;

  const paragraphs = [
    strings.intro(periodLabel),
    strings.summary(eventsCount, photosCount),
    eventsCount ? `${strings.eventsHeading}<br />${joinLines(eventLines)}` : strings.noEvents,
    photosCount ? `${strings.photosHeading}<br />${joinLines(photoLines)}` : strings.noPhotos,
  ];

  const html = renderEmailHtml({
    subject,
    lang: options.locale,
    dir: options.locale === 'he' ? 'rtl' : 'ltr',
    heading: `🌳 ${options.siteName}`,
    preheader: subject,
    greeting: strings.greeting,
    paragraphs,
    footerLines: [strings.footer, `<a href="${MANAGE_LINK_PLACEHOLDER}">${strings.manageFooterLabel}</a>`],
  });

  const textSections = [
    strings.greeting,
    strings.intro(periodLabel),
    strings.summary(eventsCount, photosCount),
    eventsCount ? [strings.eventsHeading, ...eventLines.map((line) => `• ${line}`)].join('\n') : strings.noEvents,
    photosCount ? [strings.photosHeading, ...photoLines.map((line) => `• ${line}`)].join('\n') : strings.noPhotos,
    strings.footer,
    `${strings.manageFooterLabel}: ${MANAGE_LINK_PLACEHOLDER}`,
  ];
  const text = textSections.join('\n\n');

  return { subject, html, text };
}

export class DigestTemplateService {
  static buildMonthlyDigestEmail(
    digest: DigestPayload,
    options: BuildDigestEmailOptions,
  ): DigestEmailContent {
    const periodLabel = formatMonthLabel(digest.month, digest.year, options.locale);
    const eventLines = digest.events.map((event) => formatMonthlyEventLine(event, options.locale));
    const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));

    return buildDigestEmailContent({
      cadence: 'monthly',
      periodLabel,
      eventLines,
      photoLines,
      eventsCount: digest.events.length,
      photosCount: digest.photos.length,
      options,
    });
  }

  /**
   * Weekly-cadence rolling-window variant (docs/family-digest-formats-spec.md §1) - same
   * template shape as the monthly digest, driven by DigestCompilerService.compileDigestWindow's
   * date-range payload instead of a fixed calendar month.
   */
  static buildWeeklyDigestEmail(
    digest: DigestWindowPayload,
    options: BuildDigestEmailOptions,
  ): DigestEmailContent {
    const periodLabel = formatWindowLabel(digest.startDate, digest.endDate, options.locale);
    const eventLines = digest.events.map((event) => formatWindowEventLine(event, options.locale));
    const photoLines = digest.photos.map((photo) => formatPhotoLine(photo, options.locale));

    return buildDigestEmailContent({
      cadence: 'weekly',
      periodLabel,
      eventLines,
      photoLines,
      eventsCount: digest.events.length,
      photosCount: digest.photos.length,
      options,
    });
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
