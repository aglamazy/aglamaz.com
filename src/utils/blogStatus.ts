import type { IBlogPost } from '@/entities/BlogPost';

// Missing status = 'published' (back-compat for posts written before the
// draft-review workflow existed). Every list/feed path must gate through this
// helper instead of comparing status inline, so drafts/in-review posts never
// leak into a public feed.
export function isPublished(post: Pick<IBlogPost, 'status'>): boolean {
  return !post.status || post.status === 'published';
}
