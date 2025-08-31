import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { headers, cookies } from 'next/headers';
import { TranslationService } from '@/services/TranslationService';
import TranslationWatcher from '@/components/blog/TranslationWatcher';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const handle = params.id;
  return {
    title: `Family Blog – ${handle}`,
  };
}

export default async function AuthorBlogPage({ params, searchParams }: { params: { id: string }, searchParams?: Record<string, string | string[] | undefined> }) {
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

  const h = headers();
  const accept = h.get('accept-language') || '';
  const qp = (searchParams?.lang as string | undefined)?.toString();
  const cookieLang = cookies().get('ux_lang')?.value || '';
  const lang = (qp && qp.split('-')[0]) || (cookieLang && cookieLang.split('-')[0]) || accept.split(',')[0]?.split('-')[0] || process.env.NEXT_DEFAULT_LANG || 'en';

  const choose = (p: IBlogPost) => {
    if (!lang || lang === p.sourceLang) return p;
    const translations = p.translations || {};
    const base = lang.split('-')[0]?.toLowerCase();
    let t = translations[lang] as any;
    if (!t && base) {
      const key = Object.keys(translations).find(k => {
        const kb = k.split('-')[0]?.toLowerCase();
        return k.toLowerCase() === lang.toLowerCase() || kb === base;
      });
      if (key) t = (translations as any)[key];
    }
    if (!t) return p;
    return { ...p, title: t.title || p.title, content: t.content || p.content };
  };

  let queued = false;
  const maybeTranslate = async (p: IBlogPost) => {
    if (!lang || lang === p.sourceLang) return;
    const translations = p.translations || {};
    const base = lang.split('-')[0]?.toLowerCase();
    const has = translations[lang] || Object.keys(translations).some(k => k.split('-')[0]?.toLowerCase() === base);
    if (has) return;
    try { await repo.markTranslationRequested(p.id, lang); } catch {}
    queued = true;
    if (!TranslationService.isEnabled()) return;
    (async () => {
      try {
        console.log('[translate] start', { postId: p.id, to: lang });
        const res = await TranslationService.translateHtml({ title: p.title, content: p.content, from: p.sourceLang, to: lang });
        await repo.addTranslation(p.id, lang, { title: res.title, content: res.content, engine: 'gpt' });
      } catch (e) { console.error('Author page translation failed', e); }
    })();
  };

  const localized = await Promise.all(posts.map(async (p) => { await maybeTranslate(p); return choose(p); }));

  return (
    <div className="space-y-4 p-4">
      {queued ? <TranslationWatcher enabled={true} /> : null}
      {localized.map((post) => (
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
