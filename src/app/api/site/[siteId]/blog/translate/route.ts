import { NextRequest } from 'next/server';
import { BlogRepository } from '@/repositories/BlogRepository';
import { TranslationService } from '@/services/TranslationService';
import { normalizeLang } from '@/services/LocalizationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { postId, lang } = await req.json();
    if (!postId || !lang) {
      return Response.json({ error: 'Missing postId or lang' }, { status: 400 });
    }
    const repo = new BlogRepository();
    const post = await repo.getById(postId);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    // Restrict to current site and public posts only
    const siteId = process.env.NEXT_SITE_ID || '';
    if ((post as any).siteId !== siteId || !post.isPublic) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const targetLocale = lang.toLowerCase();
    const base = normalizeLang(targetLocale) || targetLocale;
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

    if (!TranslationService.isEnabled()) {
      return Response.json({ error: 'Translation service disabled' }, { status: 503 });
    }

    const fallbackKey = Object.keys(locales)[0];
    const primary = post.primaryLocale || fallbackKey;
    const sourceEntry = primary ? locales[primary] : undefined;
    if (!primary || !sourceEntry?.title || !sourceEntry?.content) {
      return Response.json({ error: 'Missing source locale content' }, { status: 400 });
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

