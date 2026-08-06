import { NextRequest } from 'next/server';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { SUPPORTED_LOCALES } from '@/i18n';

export const dynamic = 'force-dynamic';

// Public, indexable pages that exist under every locale prefix. Kept in sync
// by hand with src/app/[locale]/* — there's no route-group introspection at
// this layer, so a new public [locale] page needs a line here too.
const STATIC_PATHS = ['', 'blog', 'contact', 'terms', 'privacy'];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/+$/, '');

  const paths = new Set<string>();
  for (const locale of SUPPORTED_LOCALES) {
    for (const staticPath of STATIC_PATHS) {
      paths.add(staticPath ? `/${locale}/${staticPath}` : `/${locale}`);
    }
  }

  // famcircle#145 GSC report: en/blog/yaakov-aglamaz, tr/blog/yaakov-aglamaz,
  // ar/blog/yaakov-aglamaz were all "unknown to Google" / "crawled, not
  // indexed" - these per-author blog pages were never discoverable except by
  // following an internal link from the blog list, and this sitemap didn't
  // exist at all. Enumerate one URL per locale per author who has at least
  // one public post, matching the /{locale}/blog/{handle} route.
  try {
    const siteId = await resolveSiteId();
    if (siteId) {
      const posts = await new BlogRepository().getPublicBySite(siteId, 100);
      if (posts.length) {
        const fam = new FamilyRepository();
        const authorIds = Array.from(new Set(posts.map((p) => p.authorId)));
        const handles = new Set<string>();
        for (const authorId of authorIds) {
          const member = await fam.getMemberByUserId(authorId, siteId);
          const handle = (member as any)?.blogHandle;
          if (handle) handles.add(handle);
        }
        for (const locale of SUPPORTED_LOCALES) {
          for (const handle of handles) {
            paths.add(`/${locale}/blog/${handle}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[sitemap.xml] failed to enumerate blog author pages', error);
  }

  const urls = Array.from(paths)
    .sort()
    .map((path) => `  <url><loc>${xmlEscape(`${base}${path}`)}</loc></url>`)
    .join('\n');

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
