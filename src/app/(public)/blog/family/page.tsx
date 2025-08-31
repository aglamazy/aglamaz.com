import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import crypto from 'crypto';
import styles from './page.module.css';
import BlogCTA from '@/components/blog/BlogCTA';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Family Blog – Recent Posts',
};

export default async function FamilyBlogPage() {
  const siteId = process.env.NEXT_SITE_ID || '';
  const repo = new BlogRepository();
  const fam = new FamilyRepository();
  const posts: IBlogPost[] = await repo.getPublicBySite(siteId, 30);

  const enriched = await Promise.all(posts.map(async (p) => {
    const m = await fam.getMemberByUserId(p.authorId, siteId);
    const email = (m as any)?.email || '';
    const handle = (m as any)?.blogHandle || '';
    const name = (m as any)?.firstName || (m as any)?.displayName || email || 'Author';
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    const avatar = `https://www.gravatar.com/avatar/${hash}?s=48&d=identicon`;
    const palette = ['bg-blue-50','bg-green-50','bg-yellow-50','bg-purple-50','bg-rose-50'];
    const colorIdx = parseInt(crypto.createHash('md5').update(String(p.id)).digest('hex').slice(0, 2), 16) % palette.length;
    const tint = palette[colorIdx];
    return { post: p, name, handle, avatar, tint };
  }));

  return (
    <div className={`space-y-4 p-4 ${styles.blobBg}`}>
      {/* Invite banner for users (client-side) */}
      <BlogCTA />
      {enriched.map(({ post, name, handle, avatar, tint }) => (
        <Card key={post.id} className="border-0 shadow-lg bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-3">
              <a href={`/blog/author/${handle}`}>
                <img src={avatar} alt="" className="h-10 w-10 rounded-full" />
              </a>
              <div>
                <CardTitle className="m-0 p-0">{post.title}</CardTitle>
                <div className="text-xs text-gray-500">
                  <a className="hover:underline" href={`/blog/author/${handle}`}>{name}</a>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`rounded-lg p-3 ${tint}`}>
              <div className={`text-sm text-gray-700 ${styles.clamp3}`} dangerouslySetInnerHTML={{ __html: post.content || '' }} />
            </div>
            <div className="mt-2">
              <a className="text-blue-600 hover:underline text-sm" href={`/blog/author/${handle}`}>Read more in {name}'s blog</a>
            </div>
          </CardContent>
        </Card>
      ))}
      {posts.length === 0 && <div>No public posts yet.</div>}
    </div>
  );
}
