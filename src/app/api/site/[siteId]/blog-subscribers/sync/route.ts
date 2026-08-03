import { NextRequest, NextResponse } from 'next/server';
import { blogSubscriberRepository } from '@/repositories/BlogSubscriberRepository';

export const dynamic = 'force-dynamic';

// Narrow, service-to-service counterpart to the sibling withAdminGuard'd
// blog-subscribers/route.ts - built for the ub04 Listmonk sync job
// (scripts/sync-listmonk-subscribers.ts, scout#169), NOT for Shofar (Buddy's
// 2026-08-03 ruling: Shofar only triggers Listmonk campaigns, it never reads
// subscriber emails - this endpoint exists because the sync job genuinely does
// need them, and per least-privilege it should get exactly this and nothing
// else, not a Firebase Admin key that reads the entire product's Firestore).
//
// Deliberately returns ONLY {email, createdAt} - no id, no siteId, nothing
// else BlogSubscriber carries - even though the caller is authenticated, this
// is still the minimum a mail-sync job needs to see.
//
// Auth: same shared-bearer-secret pattern as CRON_SECRET, but its own distinct
// secret (BLOG_SUBSCRIBERS_SYNC_SECRET) - a compromised sync secret should only
// ever leak this one narrow read, never anything a cron route can do.
export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  if (!process.env.BLOG_SUBSCRIBERS_SYNC_SECRET) {
    console.error('[blog-subscribers/sync] BLOG_SUBSCRIBERS_SYNC_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.BLOG_SUBSCRIBERS_SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { siteId } = await params;
  if (!siteId) {
    return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
  }

  try {
    const subscribers = await blogSubscriberRepository.getBySite(siteId);
    const items = subscribers.map((s) => ({ email: s.email, createdAt: s.createdAt }));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[blog-subscribers/sync] failed', error);
    return NextResponse.json({ error: 'Failed to fetch blog subscribers' }, { status: 500 });
  }
}
