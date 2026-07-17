import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlogRepository } from '@/repositories/BlogRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { GuardContext } from '@/app/api/types';
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
      const localizedPost = await repo.getLocalizedById(id, lang);
      if (!localizedPost) {
        return Response.json({ error: 'Post not found' }, { status: 404 });
      }
      // Verify post belongs to this site
      if (localizedPost.post.siteId !== siteId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      return Response.json({ post: localizedPost.post, localized: localizedPost.localized, lang });
    }
    const authorId = url.searchParams.get('authorId');
    const posts = authorId
      ? await repo.getLocalizedByAuthor(authorId, lang)
      : await repo.getLocalizedBySite(siteId, lang);
    return Response.json({ posts, lang });
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
    const { title, content, isPublic, lang, taggedMemberIds } = body;
    if (!title || !content) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }
    const accept = request.headers.get('accept-language');
    const headerLang = parseLocaleInput(accept);
    const primaryLocale = (parseLocaleInput(lang) || headerLang || DEFAULT_LANG).toLowerCase();
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
      }).catch((err) => console.error('[blog] tag notification failed:', err));
    }

    const localized = await repo.getLocalizedById(post.id, primaryLocale);
    return Response.json({ post: localized?.post ?? post, localized: localized?.localized }, { status: 201 });
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
    const { id, title, content, isPublic, lang, taggedMemberIds } = body as {
      id?: string;
      title?: string;
      content?: string;
      isPublic?: boolean;
      lang?: string;
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
      }).catch((err) => console.error('[blog] tag notification failed:', err));
    }

    const localized = await repo.getLocalizedById(id, normalizedLocale);
    return Response.json({ post: localized?.post, localized: localized?.localized });
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
