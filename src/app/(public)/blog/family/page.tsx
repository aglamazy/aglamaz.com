import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { BlogRepository } from '@/repositories/BlogRepository';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Family Blog – Recent Posts',
};

export default async function FamilyBlogPage() {
  const siteId = process.env.NEXT_SITE_ID || '';
  const repo = new BlogRepository();
  const posts: IBlogPost[] = await repo.getPublicBySite(siteId, 30);

  return (
    <div className="space-y-4 p-4">
      {posts.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <CardTitle>{post.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content || '' }}
            />
          </CardContent>
        </Card>
      ))}
      {posts.length === 0 && <div>No public posts yet.</div>}
    </div>
  );
}

