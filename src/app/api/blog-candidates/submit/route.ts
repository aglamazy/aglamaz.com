// Submission entrypoint for the Shofar -> aglamaz.com blog pipeline (hopper task-3199 /
// scout#27). Shofar's blog-compose skill (or a scheduled scan calling scout_draft.py)
// POSTs a {title, content} candidate here; this route turns it into a draft BlogPost for
// aglamaz.com, requests review, and emails the site owner a "Review draft" link into the
// EXISTING Publish/Fix/Deny page (src/app/review/[token]) - see
// BlogCandidateSubmissionService for the actual pipeline.
//
// Scope: manual/API-triggered only for now (task-3199 acceptance) - not wired to any cron
// or scheduled trigger yet; that's an explicit follow-up.
// Auth: Bearer {SHOFAR_BLOG_SUBMIT_SECRET}, same Bearer-secret pattern as every cron route
// in this app (see src/app/api/cron/blog-autogen/route.ts), but a distinct secret since the
// caller (Shofar, not Vercel Cron) is a different trust boundary.
import { NextRequest, NextResponse } from 'next/server';
import { BlogCandidateSubmissionService } from '@/services/BlogCandidateSubmissionService';

export const dynamic = 'force-dynamic';

const AGLAMAZ_COM_DOMAIN = 'aglamaz.com';

export async function POST(request: NextRequest) {
  if (!process.env.SHOFAR_BLOG_SUBMIT_SECRET) {
    console.error('[blog-candidates/submit] SHOFAR_BLOG_SUBMIT_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: SHOFAR_BLOG_SUBMIT_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SHOFAR_BLOG_SUBMIT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = (body as any)?.title;
  const content = (body as any)?.content;
  if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Body must include non-empty string fields "title" and "content"' }, { status: 400 });
  }

  try {
    const service = new BlogCandidateSubmissionService();
    const result = await service.submitCandidateForDomain(AGLAMAZ_COM_DOMAIN, { title, content });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[blog-candidates/submit] failed to submit candidate:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to submit candidate' }, { status: 500 });
  }
}
