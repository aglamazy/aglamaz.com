import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlogRepository } from '@/repositories/BlogRepository';
import { GuardContext } from '@/app/api/types';
import { TranslationService } from '@/services/TranslationService';
import type { IBlogPost } from '@/entities/BlogPost';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

function normalizeLang(input?: string | null): string | null {
  if (!input) return null;
  try {
    const code = input.split(',')[0]?.trim().split(';')[0] || '';
    const base = code.split('-')[0]?.toLowerCase();
    return base || null;
  } catch {
    return null;
  }
}

function pickPostForLang(post: IBlogPost, lang: string): IBlogPost {
  if (!lang || lang === post.sourceLang) return post;
  const translations = post.translations || {};
  const base = lang.split('-')[0]?.toLowerCase();
  let t = translations[lang] as any;
  if (!t && base) {
    const key = Object.keys(translations).find(k => {
      const kb = k.split('-')[0]?.toLowerCase();
      return k.toLowerCase() === lang.toLowerCase() || kb === base;
    });
    if (key) t = (translations as any)[key];
  }
  if (!t) return post;
  return { ...post, title: t.title || post.title, content: t.content || post.content };
}

async function maybeEnqueueTranslation(post: IBlogPost, lang: string, repo: BlogRepository) {
  if (!lang || lang === post.sourceLang) return;
  if (post.translations?.[lang]) return;
  // Debounce: only request once per hour
  const lastReq = post.translationMeta?.requested?.[lang] as any;
  const lastMs = lastReq?.toMillis ? lastReq.toMillis() : (lastReq ? new Date(lastReq).getTime() : 0);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  if (lastMs && now - lastMs < oneHour) return;
  try {
    await repo.markTranslationRequested(post.id, lang);
  } catch (e) {
    console.error('Failed to mark translation requested', e);
    // Still attempt translation to avoid user being stuck without it
  }
  if (!TranslationService.isEnabled()) return;
  (async () => {
    try {
      console.log('[translate] start', { postId: post.id, to: lang });
      const res = await TranslationService.translateHtml({
        title: post.title,
        content: post.content,
        from: post.sourceLang,
        to: lang,
      });
      await repo.addTranslation(post.id, lang, { title: res.title, content: res.content, engine: 'gpt' });
    } catch (err) {
      console.error(`Background translation failed for post ${post.id} to ${lang}:`, err);
    }
  })();
}

const getHandler = async (request: Request, _context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const qLang = url.searchParams.get('lang');
    const headerLang = normalizeLang(request.headers.get('accept-language'));
    const lang = normalizeLang(qLang) || headerLang || process.env.NEXT_DEFAULT_LANG || 'en';
    if (id) {
      const post = await repo.getById(id);
      if (!post) {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }
      await maybeEnqueueTranslation(post, lang, repo);
      const localized = pickPostForLang(post, lang);
      return Response.json({ post: localized, lang });
    }
    const authorId = url.searchParams.get('authorId');
    const posts = authorId ? await repo.getByAuthor(authorId) : await repo.getAll();
    // Fire-and-forget enqueue for missing translations and localize payload
    const localized = await Promise.all(posts.map(async (p) => {
      await maybeEnqueueTranslation(p, lang, repo);
      return pickPostForLang(p, lang);
    }));
    return Response.json({ posts: localized, lang });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const user = context.user!;
    const member = context.member!;
    const body = await request.json();
    const { title, content, isPublic, lang } = body;
    if (!title || !content) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }
    const accept = request.headers.get('accept-language') || '';
    const headerLang = accept.split(',')[0]?.split('-')[0] || '';
    const sourceLang = (lang || headerLang || process.env.NEXT_DEFAULT_LANG || 'en').toString();
    const post = await repo.create({
      authorId: user.userId,
      siteId: member.siteId,
      sourceLang,
      title,
      content,
      isPublic: Boolean(isPublic),
    });
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create post' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const user = context.user!;
    const member = context.member!;
    const body = await request.json();
    const { id, title, content, isPublic, lang } = body as { id?: string; title?: string; content?: string; isPublic?: boolean; lang?: string };
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    const existing = await repo.getById(id);
    if (!existing) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const updates: any = {};
    if (!(existing as any).siteId) {
      updates.siteId = member.siteId;
    }
    if (typeof isPublic === 'boolean') {
      updates.isPublic = !!isPublic;
    }

    // When editing in a language different from source, update translations map instead of original fields
    const normalizedLang = (lang || '').toString().split('-')[0];
    if (normalizedLang && normalizedLang !== existing.sourceLang) {
      if (title != null || content != null) {
        await repo.addTranslation(id, normalizedLang, {
          title: title ?? (existing.translations?.[normalizedLang]?.title || existing.title),
          content: content ?? (existing.translations?.[normalizedLang]?.content || existing.content),
          engine: 'manual',
        });
      }
      if (Object.keys(updates).length) {
        await repo.update(id, updates);
      }
    } else {
      // Editing the source language
      if (title != null) updates.title = title;
      if (content != null) updates.content = content;
      await repo.update(id, updates);
    }

    const updated = await repo.getById(id);
    return Response.json({ post: updated });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update post' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext) => {
  try {
    const repo = new BlogRepository();
    const user = context.user!;
    const member = context.member!;
    let id: string | null = null;
    try {
      const body = await request.json();
      id = body.id;
    } catch {
      // ignore
    }
    if (!id) {
      const url = new URL(request.url);
      id = url.searchParams.get('id');
    }
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    const existing = await repo.getById(id);
    if (!existing) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.delete(id);
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete post' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
export const PUT = withMemberGuard(putHandler);
export const DELETE = withMemberGuard(deleteHandler);
