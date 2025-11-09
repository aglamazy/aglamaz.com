import { withUserGuard } from '@/lib/withUserGuard';
import type { GuardContext } from '@/app/api/types';
import { MemberRepository, BlogRegistrationError } from '@/repositories/MemberRepository';

export const dynamic = 'force-dynamic';

type RegisterRequestBody = {
  slug?: string | null;
  blogHandle?: string | null;
  siteId?: string | null;
};

const repo = new MemberRepository();

const parseRequestBody = async (request: Request): Promise<RegisterRequestBody> => {
  try {
    return (await request.json()) as RegisterRequestBody;
  } catch {
    return {};
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

const getSiteIdFromRequest = (request: Request, body?: RegisterRequestBody): string | null => {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('siteId');
  if (fromQuery) {
    return fromQuery;
  }
  const fromBody = body?.siteId;
  return typeof fromBody === 'string' ? fromBody : null;
};

const getSlugFromQuery = (request: Request): string => {
  const url = new URL(request.url);
  return url.searchParams.get('slug') ?? '';
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const userId = await ensureSameUser(context);
    if (!userId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await parseRequestBody(request);
    const siteId = getSiteIdFromRequest(request, body);
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const slugInput =
      typeof body.slug === 'string'
        ? body.slug
        : typeof body.blogHandle === 'string'
          ? body.blogHandle
          : '';

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

    const siteId = getSiteIdFromRequest(request);
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
