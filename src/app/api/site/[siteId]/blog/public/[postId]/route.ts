import { BlogRepository } from '@/repositories/BlogRepository';
import { localizeBlogPost } from '@/utils/blogLocales';

export const dynamic = 'force-dynamic';

const DEFAULT_LANG = (process.env.NEXT_DEFAULT_LANG || 'en').toLowerCase();

function parseLocale(value?: string | null): string | undefined {
  if (!value) return undefined;
  const raw = value.split(',')[0]?.trim();
  if (!raw) return undefined;
  const code = raw.split(';')[0]?.trim();
  return code ? code.toLowerCase() : undefined;
}

export const GET = async (request: Request, { params }: { params: Promise<{ postId: string }> }) => {
  try {
    const { postId } = await params;
    const repo = new BlogRepository();
    const post = await repo.getById(postId);
    if (!post || !post.isPublic) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    const preferred = parseLocale(request.headers.get('accept-language')) || DEFAULT_LANG;
    const localized = localizeBlogPost(post, {
      preferredLocale: preferred,
      fallbackLocales: [DEFAULT_LANG],
    });
    return Response.json({ post, localized: localized.localized, lang: preferred });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
};
