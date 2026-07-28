import { after } from 'next/server';
import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlogRepository } from '@/repositories/BlogRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { GuardContext } from '@/app/api/types';
import { TranslationService } from '@/services/TranslationService';
import { normalizeLang } from '@/services/LocalizationService';
import type { IBlogPost, LocalizedBlogPost } from '@/entities/BlogPost';
import { localizeBlogPost } from '@/utils/blogLocales';
import { extractFirstImageUrl } from '@/utils/extractFirstImageUrl';
import { TagNotificationService } from '@/services/TagNotificationService';

const DEFAULT_LANG = (process.env.NEXT_DEFAULT_LANG || 'en').toLowerCase();

export const dynamic = 'force-dynamic';

function parseLocaleInput(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = value.split(',')[0]?.trim();
  if (!raw) return undefined;
  const withoutWeight = raw.split(';')[0]?.trim();
  return withoutWeight ? withoutWeight.toLowerCase() : undefined;
}

function hasLocaleContent(post: IBlogPost, locale: string): boolean {
  const locales = post.locales || {};
  const normalized = locale.toLowerCase();
  const base = normalizeLang(normalized);
  const direct = locales[normalized];
  if (direct?.title && direct?.content) {
    return true;
  }
  if (!base) return false;
  return Object.entries(locales).some(([key, value]) => {
    if (!value?.title || !value?.content) return false;
    return normalizeLang(key) === base;
  });
}

function shouldRequestBlogTranslation(post: IBlogPost, lang: string | undefined): boolean {
  if (!lang) return false;
  const normalized = lang.toLowerCase();
  if (!normalized) return false;
  const base = normalizeLang(normalized);
  const primaryBase = normalizeLang(post.primaryLocale);
  if (!base || base === primaryBase) {
    return false;
  }
  return !hasLocaleContent(post, normalized);
}

async function maybeEnqueueTranslation(post: IBlogPost, lang: string | undefined, repo: BlogRepository) {
  if (!lang) return;
  const normalized = lang.toLowerCase();
  if (!shouldRequestBlogTranslation(post, normalized)) return;

  const locales = post.locales || {};
  const fallbackKey = Object.keys(locales)[0];
  const primary = post.primaryLocale || fallbackKey || DEFAULT_LANG;
  const sourceEntry = locales[primary] ?? (fallbackKey ? locales[fallbackKey] : undefined);
  if (!sourceEntry?.title || !sourceEntry?.content) {
    return;
  }

  const base = normalizeLang(normalized) || normalized;

  try {
    await repo.markTranslationRequested(post.id, normalized);
  } catch (error) {
    console.error('Failed to mark translation requested', error);
  }

  if (!TranslationService.isEnabled()) return;

  // NOTE: must be scheduled via next/server's after(), not a bare unawaited
  // IIFE. Vercel serverless functions can freeze the execution context
  // immediately once the HTTP response is sent - a fire-and-forget promise
  // races that freeze and can be silently killed mid-flight before ever
  // calling addTranslation(), with no error logged anywhere (famcircle#105
  // follow-up: markTranslationRequested's attempts counter kept incrementing
  // on every pageview with zero corresponding OpenAI calls ever completing).
  // after() tells the runtime to keep the function alive until this resolves.
  after(async () => {
    try {
      console.log('[translate] start', { postId: post.id, to: normalized });
      const res = await TranslationService.translateHtml({
        title: sourceEntry.title || '',
        content: sourceEntry.content || '',
        from: normalizeLang(primary) || primary,
        to: base,
      });
      await repo.addTranslation(post.id, normalized, {
        title: res.title,
        content: res.content,
        engine: 'gpt',
        sourceLocale: primary,
      });
    } catch (error) {
      console.error(`Background translation failed for post ${post.id} to ${normalized}:`, error);
    }
  });
}

function localize(post: IBlogPost, locale: string | undefined): LocalizedBlogPost {
  return localizeBlogPost(post, {
    preferredLocale: locale,
    fallbackLocales: [DEFAULT_LANG],
  });
}

const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new BlogRepository();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const qLang = parseLocaleInput(url.searchParams.get('lang'));
    const headerLang = parseLocaleInput(request.headers.get('accept-language'));
    const lang = qLang || headerLang || DEFAULT_LANG;
    if (id) {
      const post = await repo.getById(id);
      if (!post) {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }
      // Verify post belongs to this site
      if (post.siteId !== siteId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      await maybeEnqueueTranslation(post, lang, repo);
      const localized = localize(post, lang);
      return Response.json({ post, localized: localized.localized, lang });
    }
    const status = url.searchParams.get('status');
    if (status === 'in_review') {
      // Admin-only: pending drafts are review-gate content, not general blog reading
      // (Agla/Shofar 2026-07-27 - the "drafts waiting for review" list).
      if (context.member?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const pending = await repo.getInReviewBySite(siteId);
      const localizedPending = pending.map((post) => localize(post, lang));
      return Response.json({ posts: localizedPending, lang });
    }

    const authorId = url.searchParams.get('authorId');
    const posts = authorId ? await repo.getByAuthor(authorId) : await repo.getBySite(siteId);
    const localizedPosts: LocalizedBlogPost[] = [];
    for (const post of posts) {
      await maybeEnqueueTranslation(post, lang, repo);
      localizedPosts.push(localize(post, lang));
    }
    return Response.json({ posts: localizedPosts, lang });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new BlogRepository();
    const user = context.user!;
    const body = await request.json();
    const { title, content, isPublic, lang, contentFormat, taggedMemberIds } = body;
    if (!title || !content) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }
    const accept = request.headers.get('accept-language');
    const headerLang = parseLocaleInput(accept);
    const primaryLocale = (parseLocaleInput(lang) || headerLang || DEFAULT_LANG).toLowerCase();
    // Default 'html' if client omits the field — keeps the legacy posting flow working unchanged.
    const normalizedFormat: 'md' | 'html' = contentFormat === 'md' ? 'md' : 'html';
    const validTaggedMemberIds = await TagNotificationService.filterSiteMemberIds(taggedMemberIds, siteId);
    const post = await repo.create({
      authorId: user.userId,
      siteId: siteId,
      primaryLocale,
      localeContent: {
        title,
        content,
        engine: 'manual',
        sourceLocale: primaryLocale,
      },
      isPublic: Boolean(isPublic),
      contentFormat: normalizedFormat,
      taggedMemberIds: validTaggedMemberIds,
    });

    if (validTaggedMemberIds.length) {
      const memberRepo = new MemberRepository();
      const author = await memberRepo.getById(user.userId);
      const taggedByName = author?.displayName || user.email || 'Someone';
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      await TagNotificationService.notifyTaggedMembers({
        siteId,
        taggedMemberIds: validTaggedMemberIds,
        taggedByMemberId: user.userId,
        taggedByName,
        contentType: 'post',
        contentLink: `${appUrl}/app/blog`,
        imageUrl: extractFirstImageUrl(content),
      }).catch((err) => console.error('[blog] tag notification failed:', err));
    }

    const localized = localize(post, primaryLocale);
    return Response.json({ post, localized: localized.localized }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create post' }, { status: 500 });
  }
};

const putHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const repo = new BlogRepository();
    const user = context.user!;
    const member = context.member!;
    const body = await request.json();
    const { id, title, content, isPublic, lang, contentFormat, taggedMemberIds } = body as {
      id?: string;
      title?: string;
      content?: string;
      isPublic?: boolean;
      lang?: string;
      contentFormat?: 'md' | 'html';
      taggedMemberIds?: string[];
    };
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    const existing = await repo.getById(id);
    if (!existing) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    // Verify post belongs to this site
    if (existing.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const updates: Record<string, unknown> = {};
    if (!(existing as any).siteId) {
      updates.siteId = siteId;
    }
    if (typeof isPublic === 'boolean') {
      updates.isPublic = !!isPublic;
    }
    if (contentFormat === 'md' || contentFormat === 'html') {
      updates.contentFormat = contentFormat;
    }

    let newlyTaggedMemberIds: string[] = [];
    if (Array.isArray(taggedMemberIds)) {
      const validTaggedMemberIds = await TagNotificationService.filterSiteMemberIds(taggedMemberIds, siteId);
      updates.taggedMemberIds = validTaggedMemberIds;
      const previouslyTagged = new Set(existing.taggedMemberIds || []);
      newlyTaggedMemberIds = validTaggedMemberIds.filter((mid) => !previouslyTagged.has(mid));
    }

    const targetLocale = parseLocaleInput(lang) || existing.primaryLocale;
    const normalizedLocale = targetLocale.toLowerCase();
    const localePayload: Record<string, unknown> = {};
    if (title !== undefined) {
      localePayload.title = title;
    }
    if (content !== undefined) {
      localePayload.content = content;
    }

    if (Object.keys(localePayload).length > 0) {
      await repo.upsertLocale(id, normalizedLocale, {
        ...(localePayload as { title?: string; content?: string }),
        engine: 'manual',
        sourceLocale: normalizedLocale === existing.primaryLocale ? normalizedLocale : existing.primaryLocale,
      });
    }

    if (Object.keys(updates).length) {
      await repo.update(id, updates);
    }

    const updated = await repo.getById(id);
    const localized = updated ? localize(updated, normalizedLocale) : null;

    if (newlyTaggedMemberIds.length) {
      const memberRepo = new MemberRepository();
      const editor = await memberRepo.getById(user.userId);
      const taggedByName = editor?.displayName || user.email || 'Someone';
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      await TagNotificationService.notifyTaggedMembers({
        siteId,
        taggedMemberIds: newlyTaggedMemberIds,
        taggedByMemberId: user.userId,
        taggedByName,
        contentType: 'post',
        contentLink: `${appUrl}/app/blog`,
        imageUrl: extractFirstImageUrl(localized?.localized.content),
      }).catch((err) => console.error('[blog] tag notification failed:', err));
    }

    return Response.json({ post: updated, localized: localized?.localized });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update post' }, { status: 500 });
  }
};

const deleteHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    // Verify post belongs to this site
    if (existing.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (existing.authorId !== user.userId && member.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    await repo.softDelete(id);
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
