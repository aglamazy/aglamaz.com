import { NextRequest } from 'next/server';
import { BlogRepository } from '@/repositories/BlogRepository';
import { TranslationService } from '@/services/TranslationService';
import { normalizeLang } from '@/services/LocalizationService';
import { checkRateLimit } from '@/lib/rateLimit';
import { SUPPORTED_LOCALES } from '@/i18n';

export const dynamic = 'force-dynamic';

// Reachable with no session (see proxy.ts's PUBLIC_API_PATTERNS - it has to
// be, since it's what makes the public /{locale}/blog pages' TranslationTrigger
// actually work for anonymous visitors, famcircle#140). That means, unlike the
// withMemberGuard'd sibling logic in blog/route.ts, this route is directly
// reachable by anyone and must defend itself:
//  - lang is restricted to the app's own supported locale set, not any string
//    the caller sends - otherwise a caller could enumerate arbitrary "locales"
//    forever, each bypassing the already-translated dedup below and forcing a
//    fresh (billed) OpenAI call every time.
//  - rate-limited per IP and per postId+lang, same pattern as the other public
//    write path (blessing-pages/.../blessings/public/route.ts).
//  - markTranslationRequested's recent-request timestamp is checked before
//    calling out to OpenAI, so concurrent page loads racing the same
//    translation (before addTranslation has persisted) don't each fire their
//    own OpenAI call.
const RATE_LIMIT_PER_IP = { limit: 20, windowMs: 10 * 60 * 1000 };
const RATE_LIMIT_PER_POST_LANG = { limit: 5, windowMs: 10 * 60 * 1000 };
const IN_FLIGHT_WINDOW_MS = 60 * 1000;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const { postId, lang } = await req.json();
    if (!postId || typeof postId !== 'string' || !lang || typeof lang !== 'string') {
      return Response.json({ error: 'Missing postId or lang' }, { status: 400 });
    }

    const targetLocale = lang.toLowerCase();
    const base = normalizeLang(targetLocale) || targetLocale;
    if (!SUPPORTED_LOCALES.includes(base)) {
      return Response.json({ error: 'Unsupported locale' }, { status: 400 });
    }

    const ip = getClientIp(req);
    const perIp = checkRateLimit(`translate:ip:${ip}`, RATE_LIMIT_PER_IP);
    const perPostLang = checkRateLimit(`translate:post:${postId}:${base}`, RATE_LIMIT_PER_POST_LANG);
    if (!perIp.allowed || !perPostLang.allowed) {
      return Response.json({ error: 'Too many translation requests, please try again later' }, { status: 429 });
    }

    const repo = new BlogRepository();
    const post = await repo.getById(postId);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    // Restrict to current site and public posts only
    const siteId = process.env.NEXT_SITE_ID || '';
    if ((post as any).siteId !== siteId || !post.isPublic) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const locales = post.locales || {};
    const hasExact = locales[targetLocale]?.title && locales[targetLocale]?.content;
    const hasBase = Object.entries(locales).some(([key, value]) => {
      if (!value?.title || !value?.content) return false;
      return normalizeLang(key) === base;
    });
    const primaryBase = normalizeLang(post.primaryLocale);
    if (hasExact || hasBase || base === primaryBase) {
      return Response.json({ ok: true, already: true });
    }

    const requestedAt = post.translationMeta?.requested?.[base];
    const requestedMs = requestedAt?.toMillis ? requestedAt.toMillis() : requestedAt ? new Date(requestedAt).getTime() : 0;
    if (requestedMs && Date.now() - requestedMs < IN_FLIGHT_WINDOW_MS) {
      return Response.json({ ok: true, pending: true });
    }

    if (!TranslationService.isEnabled()) {
      return Response.json({ error: 'Translation service disabled' }, { status: 503 });
    }

    const fallbackKey = Object.keys(locales)[0];
    const primary = post.primaryLocale || fallbackKey;
    const sourceEntry = primary ? locales[primary] : undefined;
    if (!primary || !sourceEntry?.title || !sourceEntry?.content) {
      return Response.json({ error: 'Missing source locale content' }, { status: 400 });
    }

    try {
      await repo.markTranslationRequested(post.id, base);
    } catch (error) {
      console.error('Failed to mark translation requested', error);
    }

    console.log('[translate] sync', { postId, to: lang });
    const result = await TranslationService.translateHtml({
      title: sourceEntry.title,
      content: sourceEntry.content,
      from: normalizeLang(primary) || primary,
      to: base,
    });
    await repo.addTranslation(post.id, targetLocale, {
      title: result.title,
      content: result.content,
      engine: 'gpt',
      sourceLocale: primary,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('translate sync failed', error);
    return Response.json({ error: 'Failed to translate' }, { status: 500 });
  }
}

