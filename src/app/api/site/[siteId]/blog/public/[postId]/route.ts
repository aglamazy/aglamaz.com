import { BlogRepository } from '@/repositories/BlogRepository';
import { DEFAULT_LOCALE } from '@/i18n';

export const dynamic = 'force-dynamic';

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
    const preferred = parseLocale(request.headers.get('accept-language')) || DEFAULT_LOCALE;
    const localized = await repo.getLocalizedById(postId, preferred);
    if (!localized || !localized.post.isPublic) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    return Response.json({ post: localized.post, localized: localized.localized, lang: preferred });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
};
