import { BlogRepository } from '@/repositories/BlogRepository';
import { notFound } from 'next/navigation';
import PublicPost from '@/components/blog/PublicPost';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE } from '@/i18n';

export default async function PublicBlogPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const repo = new BlogRepository();
  const headerStore = await headers();
  const preferred = headerStore.get('accept-language')?.split(',')[0]?.split(';')[0]?.toLowerCase() || DEFAULT_LOCALE;
  const localized = await repo.getLocalizedById(postId, preferred);
  if (!localized || !localized.post.isPublic) {
    notFound();
  }
  return <PublicPost post={localized.post} localized={localized.localized} />;
}
