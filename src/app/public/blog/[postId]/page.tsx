import { BlogRepository } from '@/repositories/BlogRepository';
import { notFound } from 'next/navigation';
import PublicPost from '@/components/blog/PublicPost';
import { headers } from 'next/headers';
import { localizeBlogPost } from '@/utils/blogLocales';
import { DEFAULT_LOCALE } from '@/i18n';

export default async function PublicBlogPostPage({ params }: { params: { postId: string } }) {
  const repo = new BlogRepository();
  const post = await repo.getById(params.postId);
  if (!post || !post.isPublic) {
    notFound();
  }
  const headerStore = await headers();
  const preferred = headerStore.get('accept-language')?.split(',')[0]?.split(';')[0]?.toLowerCase() || post.primaryLocale || DEFAULT_LOCALE;
  const localized = localizeBlogPost(post, { preferredLocale: preferred, fallbackLocales: [DEFAULT_LOCALE] });
  return <PublicPost post={post} localized={localized.localized} />;
}
