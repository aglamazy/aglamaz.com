import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { headers, cookies } from 'next/headers';
import TranslationTrigger from '@/components/blog/TranslationTrigger';
import I18nText from '@/components/I18nText';
import blogStyles from '@/components/blog/PublicPost.module.css';
import AuthorPostActions from '@/components/blog/AuthorPostActions';
import { stripScriptTags, cleanJsonLd } from '@/utils/jsonld';
import { fetchSiteInfo } from '@/firebase/admin';
import { getServerT } from '@/utils/serverTranslations';
import { createProfilePageSchema, createBlogPostListSchema, type AuthorInfo } from '@/utils/blogSchema';
import crypto from 'crypto';

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

  const baseLang = lang.split('-')[0]?.toLowerCase() || lang.toLowerCase();
  const t = await getServerT(baseLang);

  let siteInfo: Record<string, unknown> | null = null;
  try {
    siteInfo = (await fetchSiteInfo()) as Record<string, unknown> | null;
  } catch (error) {
    console.error('[blog/author] failed to fetch site info', error);
    throw error;
  }

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

  const localized = posts.map((p) => choose(p));

  const clientPosts = posts.map((p) => ({
    id: p.id,
    sourceLang: p.sourceLang,
    translations: Object.fromEntries(
      Object.entries(p.translations || {}).map(([k, v]: any) => [k, { title: String(v?.title || ''), content: String(v?.content || '') }])
    ) as Record<string, { title: string; content: string }>,
  }));

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '') || undefined;
  const siteName =
    (siteInfo?.translations && typeof (siteInfo.translations as any)?.[baseLang] === 'string'
      ? String((siteInfo.translations as any)[baseLang])
      : typeof siteInfo?.name === 'string'
        ? String(siteInfo.name)
        : 'FamilyCircle');

  const authorName =
    (member as any)?.displayName ||
    (member as any)?.firstName ||
    (member as any)?.email ||
    params.id;

  const authorEmail = (member as any)?.email || '';
  const hash = crypto.createHash('md5').update(authorEmail.trim().toLowerCase()).digest('hex');
  const authorAvatar = `https://www.gravatar.com/avatar/${hash}?s=48&d=identicon`;

  const author: AuthorInfo = {
    name: authorName,
    handle: params.id,
    avatar: authorAvatar,
    email: authorEmail,
  };

  const profileSchema = createProfilePageSchema(author, {
    baseUrl,
    siteName,
    lang: baseLang,
  });

  const postsListSchema = createBlogPostListSchema(
    localized,
    localized.map(() => author),
    { baseUrl, siteName, lang: baseLang }
  );

  const structuredData = stripScriptTags(JSON.stringify([profileSchema, postsListSchema].map(cleanJsonLd)));

  return (
    <div className="space-y-4 p-4">
      <script
        id="__INITIAL_LANG__"
        dangerouslySetInnerHTML={{ __html: `window.__INITIAL_LANG__=${JSON.stringify(lang.split('-')[0]?.toLowerCase() || lang.toLowerCase())};` }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <TranslationTrigger posts={clientPosts} lang={lang} />
      {localized.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold text-charcoal m-0">{post.title}</h1>
              <AuthorPostActions postId={post.id} authorId={post.authorId} />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`prose max-w-none ${blogStyles.content}`}
              dangerouslySetInnerHTML={{ __html: post.content || '' }}
            />
          </CardContent>
        </Card>
      ))}
      {posts.length === 0 && <div><I18nText k="noPostsYet" /></div>}
    </div>
  );
}
