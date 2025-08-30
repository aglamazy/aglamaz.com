import { NextRequest } from 'next/server';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';

export const dynamic = 'force-dynamic';

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(req: NextRequest) {
  try {
    const siteId = process.env.NEXT_SITE_ID || '';
    const url = new URL(req.url);
    const base = (process.env.NEXT_PUBLIC_APP_URL || `${url.origin}`)?.replace(/\/+$/, '');

    const fam = new FamilyRepository();
    const blogAuthors = await fam.getMembersWithBlog(siteId);

    const repo = new BlogRepository();

    const urls: { loc: string; lastmod?: string }[] = [];
    // Home-like entries
    urls.push({ loc: `${base}/` });
    urls.push({ loc: `${base}/blog` });

    // Author pages and best-effort lastmod from latest public post
    for (const m of blogAuthors as any[]) {
      const handle = m.blogHandle;
      const uid = m.uid || m.userId;
      if (!handle || !uid) continue;
      let lastmod: string | undefined;
      try {
        const posts = await repo.getByAuthor(uid);
        const pub = posts.filter(p => (p as any).siteId === siteId && p.isPublic);
        if (pub.length) {
          const max = pub.reduce((acc, p) => {
            const t = (p.createdAt as any)?.toMillis ? (p.createdAt as any).toMillis() : Date.parse(String(p.createdAt));
            return Math.max(acc, isNaN(t) ? 0 : t);
          }, 0);
          if (max > 0) lastmod = new Date(max).toISOString();
        }
      } catch {}
      urls.push({ loc: `${base}/blog/author/${encodeURIComponent(handle)}`, lastmod });
    }

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(u => {
        const lines = [`  <url>`, `    <loc>${xmlEscape(u.loc)}</loc>`];
        if (u.lastmod) lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
        lines.push('  </url>');
        return lines.join('\n');
      }),
      '</urlset>'
    ].join('\n');

    return new Response(body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (e) {
    console.error('sitemap error', e);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      status: 200,
    });
  }
}

