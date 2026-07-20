// Weekly-cadence digest cron: sends the rolling "this week + up to ~1 month out" window to
// every member whose magazineCadence preference is 'weekly' (docs/family-digest-formats-spec.md
// §1) - the longer alert memorial dates need, seen 3-4 times in the run-up rather than once.
// Schedule: 0 6 * * 1 (06:00 UTC every Monday) — configured in vercel.json.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.
// Shares its compiler/template/send logic with the monthly-cadence cron
// (src/app/api/cron/digest/route.ts) via DigestSendService.runDigestCadence - one mechanism,
// cadence resolved per-member, not two parallel systems.

import { NextRequest, NextResponse } from 'next/server';
import { runDigestCadence } from '@/services/DigestSendService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/digest-weekly] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDigestCadence('weekly', request.nextUrl.origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/digest-weekly] failed:', err);
    return NextResponse.json({ error: 'Failed to run weekly digest' }, { status: 500 });
  }
}
