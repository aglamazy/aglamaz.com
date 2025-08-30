import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_APP_URL || `${url.origin}`)?.replace(/\/+$/, '');
  const body = [
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${base}/sitemap.xml`,
    ''
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

