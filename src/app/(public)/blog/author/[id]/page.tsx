import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const handle = params.id;
  return {
    title: `Family Blog – ${handle}`,
  };
}

export default async function AuthorBlogPage({ params }: { params: { id: string } }) {
  const siteId = process.env.NEXT_SITE_ID || '';
  const fam = new FamilyRepository();
  const member = await fam.getMemberByHandle(params.id, siteId);
  const uid = (member as any)?.userId || (member as any)?.uid || '';
  const repo = new BlogRepository();
  const list = uid ? await repo.getByAuthor(uid) : [];
  const posts: IBlogPost[] = (list || [])
    .filter(p => (p as any).siteId === siteId && p.isPublic)
    .sort((a, b) => {
      const at = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : new Date(a.createdAt).getTime();
      const bt = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : new Date(b.createdAt).getTime();
      return bt - at;
    });

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
      {posts.length === 0 && <div>No posts yet.</div>}
    </div>
  );
}
