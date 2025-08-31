import { NextRequest } from 'next/server';
import { BlogRepository } from '@/repositories/BlogRepository';
import { TranslationService } from '@/services/TranslationService';

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

    const base = lang.split('-')[0]?.toLowerCase();
    const translations = post.translations || {};
    const has = (translations as any)[lang] || Object.keys(translations).some(k => k.split('-')[0]?.toLowerCase() === base);
    if (has || base === (post.sourceLang || '').split('-')[0]) {
      return Response.json({ ok: true, already: true });
    }

    if (!TranslationService.isEnabled()) {
      return Response.json({ error: 'Translation service disabled' }, { status: 503 });
    }

    console.log('[translate] sync', { postId, to: lang });
    const result = await TranslationService.translateHtml({
      title: post.title,
      content: post.content,
      from: post.sourceLang,
      to: base || lang,
    });
    await repo.addTranslation(post.id, base || lang, { title: result.title, content: result.content, engine: 'gpt' });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('translate sync failed', error);
    return Response.json({ error: 'Failed to translate' }, { status: 500 });
  }
}

