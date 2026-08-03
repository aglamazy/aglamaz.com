import { BlogRepository } from '@/repositories/BlogRepository';
import { localizeBlogPost } from '@/utils/blogLocales';

export const dynamic = 'force-dynamic';

const DEFAULT_LANG = (process.env.NEXT_DEFAULT_LANG || 'en').toLowerCase();
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLocale(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = value.split(',')[0]?.trim();
  if (!raw) return undefined;
  const code = raw.split(';')[0]?.trim();
  return code ? code.toLowerCase() : undefined;
}

// Public, unauthenticated LIST of a site's published posts - the collection-level
// counterpart to public/[postId]/route.ts, same data the site's own /{locale}/blog
// page renders (getPublicBySite already filters isPublic + status via isPublished()).
// Built for external readers (famcircle scout#169 - Listmonk campaign source) that
// need to enumerate posts without either scraping the HTML page or being handed
// direct Firestore credentials.
export const GET = async (request: Request, { params }: { params: Promise<{ siteId: string }> }) => {
  try {
    const { siteId } = await params;
    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    const url = new URL(request.url);
    const requestedLimit = parseInt(url.searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const repo = new BlogRepository();
    const posts = await repo.getPublicBySite(siteId, limit);

    const preferred = parseLocale(request.headers.get('accept-language')) || DEFAULT_LANG;
    const items = posts.map((post) => {
      const { localized } = localizeBlogPost(post, {
        preferredLocale: preferred,
        fallbackLocales: [DEFAULT_LANG],
      });
      return {
        id: post.id,
        title: localized.title,
        publishedAt: post.createdAt,
      };
    });

    return Response.json({ items, lang: preferred });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
};
