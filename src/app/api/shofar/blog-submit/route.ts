// Inbound trigger for Shofar's blog-compose skill (task #10 / scout#27, 2026-08-03): given a
// {title, content} candidate for aglamaz.com, drafts a BlogPost, requests review, and emails
// the site admins the existing 3-button (Publish/Fix/Deny) review link - no new UI, reuses
// the review pipeline BlogAutogenService already rides for FamCircle's auto-blog. This route
// never writes status:'published' directly (see ShofarBlogSubmissionService).
//
// Site resolution deliberately goes through domainMappings (fetchSiteIdByDomain, the same
// helper resolveSiteId() uses for real requests) rather than a hardcoded siteId.
//
// Auth: shared-secret Bearer token, same pattern as the cron routes' CRON_SECRET, but a
// distinct secret since the caller here is Shofar/Buddy, not Vercel Cron.
import { NextRequest, NextResponse } from 'next/server';
import { fetchSiteIdByDomain } from '@/firebase/admin';
import { ShofarBlogSubmissionService } from '@/services/ShofarBlogSubmissionService';

export const dynamic = 'force-dynamic';

const AGLAMAZ_COM_DOMAIN = 'aglamaz.com';

export async function POST(request: NextRequest) {
  if (!process.env.SHOFAR_BLOG_SUBMIT_SECRET) {
    console.error('[shofar/blog-submit] SHOFAR_BLOG_SUBMIT_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: SHOFAR_BLOG_SUBMIT_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SHOFAR_BLOG_SUBMIT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { title?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { title, content } = body;
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  const siteId = await fetchSiteIdByDomain(AGLAMAZ_COM_DOMAIN);
  if (!siteId) {
    // Per task spec: do NOT guess a siteId - a missing domainMapping is a config gap to
    // report/fix separately, not to paper over here.
    console.error(`[shofar/blog-submit] no domainMappings entry for ${AGLAMAZ_COM_DOMAIN}`);
    return NextResponse.json({ error: `No domain mapping found for ${AGLAMAZ_COM_DOMAIN}` }, { status: 500 });
  }

  const service = new ShofarBlogSubmissionService();
  try {
    const result = await service.submitCandidate(siteId, { title: title.trim(), content: content.trim() });
    if (result.outcome !== 'created') {
      console.error(`[shofar/blog-submit] submission not created: site=${siteId} outcome=${result.outcome}`);
      return NextResponse.json({ error: result.outcome }, { status: 422 });
    }
    console.log(`[shofar/blog-submit] created: site=${siteId} post=${result.postId}`);
    return NextResponse.json({ postId: result.postId, reviewToken: result.reviewToken });
  } catch (err) {
    console.error(`[shofar/blog-submit] failed for site ${siteId}:`, err);
    return NextResponse.json({ error: 'Failed to submit candidate' }, { status: 500 });
  }
}
