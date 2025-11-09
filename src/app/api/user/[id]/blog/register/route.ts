import { withUserGuard } from '@/lib/withUserGuard';
import type { GuardContext } from '@/app/api/types';
import { MemberRepository, BlogRegistrationError } from '@/repositories/MemberRepository';

export const dynamic = 'force-dynamic';

const validateRequest = async (request: Request) => {
  try {
    return (await request.json()) as { slug?: string | null };
  } catch {
    return { slug: '' };
  }
};

const ensureSameUser = async (context: GuardContext): Promise<string | null> => {
  const params = context.params instanceof Promise ? await context.params : context.params;
  const requestedId = params?.id;
  const userId = context.user?.sub || null;
  if (requestedId && userId && requestedId !== userId) {
    return null;
  }
  return userId;
};

const getSiteId = (request: Request): string | null => {
  const url = new URL(request.url);
  return url.searchParams.get('siteId');
};

const getSlugFromQuery = (request: Request): string => {
  const url = new URL(request.url);
  return url.searchParams.get('slug') ?? '';
};

const repo = new MemberRepository();

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const userId = await ensureSameUser(context);
    if (!userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const siteId = getSiteId(request);
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const body = await validateRequest(request);
    const slugInput = body?.slug ?? '';
    const handle = await repo.registerBlog(userId, siteId, slugInput);
    return Response.json({ ok: true, slug: handle });
  } catch (error) {
    if (error instanceof BlogRegistrationError) {
      const statusMap: Record<typeof error.code, number> = {
        invalid: 400,
        not_found: 404,
        handle_taken: 409,
        immutable: 409,
      };
      return Response.json({ error: error.message, code: error.code }, { status: statusMap[error.code] ?? 400 });
    }
    console.error('[blog][register] failed', error);
    return Response.json({ error: 'Failed to register blog' }, { status: 500 });
  }
};

const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const userId = await ensureSameUser(context);
    if (!userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const siteId = getSiteId(request);
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const slugInput = getSlugFromQuery(request);
    const normalized = repo.normalizeBlogHandle(slugInput);
    const existing = normalized ? await repo.getByBlogHandle(siteId, normalized) : null;
    const available = !existing || existing.uid === userId;

    return Response.json({ slug: normalized, available });
  } catch (error) {
    console.error('[blog][register] probe failed', error);
    return Response.json({ error: 'Failed to validate slug' }, { status: 500 });
  }
};

export const POST = withUserGuard(postHandler);
export const GET = withUserGuard(getHandler);
