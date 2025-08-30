import { BlogRepository } from '@/repositories/BlogRepository';
import { notFound } from 'next/navigation';
import PublicPost from '@/components/blog/PublicPost';

export default async function PublicBlogPostPage({ params }: { params: { postId: string } }) {
  const repo = new BlogRepository();
  const post = await repo.getById(params.postId);
  if (!post || !post.isPublic) {
    notFound();
  }
  return <PublicPost post={post} />;
}
