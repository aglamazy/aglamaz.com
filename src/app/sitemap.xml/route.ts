import { NextRequest } from 'next/server';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { SUPPORTED_LOCALES } from '@/constants/i18n';

export const dynamic = 'force-dynamic';

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateAlternateLinks(base: string, path: string) {
  const normalized = path.replace(/^\/+/, '');
  const entries = SUPPORTED_LOCALES.map((locale) =>
    `    <xhtml:link rel="alternate" hreflang="${locale}" href="${xmlEscape(`${base}/${locale}${normalized ? `/${normalized}` : ''}`)}" />`
  );
  entries.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(`${base}/en${normalized ? `/${normalized}` : ''}`)}" />`);
  return entries;
}

export async function GET(req: NextRequest) {
  try {
    const siteId = process.env.NEXT_SITE_ID || '';
    const url = new URL(req.url);
    const base = (process.env.NEXT_PUBLIC_APP_URL || `${url.origin}`)?.replace(/\/+$/, '');

    const fam = new FamilyRepository();
    const blogAuthors = await fam.getMembersWithBlog(siteId);

    const repo = new BlogRepository();

    type RouteEntry = { path: string; lastmod?: string };
    const routes: RouteEntry[] = [{ path: '' }, { path: 'blog' }];

    for (const m of blogAuthors as any[]) {
      const handle = m.blogHandle;
      const uid = m.uid || m.userId;
      if (!handle || !uid) continue;
      let lastmod: string | undefined;
      try {
        const posts = await repo.getByAuthor(uid);
        const pub = posts.filter((p) => (p as any).siteId === siteId && p.isPublic);
        if (pub.length) {
          const max = pub.reduce((acc, p) => {
            const t = (p.createdAt as any)?.toMillis
              ? (p.createdAt as any).toMillis()
              : Date.parse(String(p.createdAt));
            return Math.max(acc, Number.isNaN(t) ? 0 : t);
          }, 0);
          if (max > 0) lastmod = new Date(max).toISOString();
        }
      } catch {}
      routes.push({ path: `blog/${encodeURIComponent(handle)}`, lastmod });
    }

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
      '<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      ...routes.flatMap((route) =>
        SUPPORTED_LOCALES.map((locale) => {
          const normalized = route.path.replace(/^\/+/, '');
          const localizedPath = normalized ? `/${locale}/${normalized}` : `/${locale}`;
          const loc = `${base}${localizedPath}`;
          const lines = [`  <url>`, `    <loc>${xmlEscape(loc)}</loc>`];
          if (route.lastmod) {
            lines.push(`    <lastmod>${route.lastmod}</lastmod>`);
          }
          lines.push(...generateAlternateLinks(base, route.path));
          lines.push('  </url>');
          return lines.join('\n');
        })
      ),
      '</urlset>',
    ].join('\n');

    return new Response(body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    console.error('sitemap error', e);
    return new Response('<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?><urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      status: 200,
    });
  }
}
