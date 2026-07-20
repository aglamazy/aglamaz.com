// Monthly-cadence digest cron: sends the month-in-review to every member whose
// magazineCadence preference is 'monthly' (docs/family-digest-formats-spec.md §1).
// Schedule: 0 6 1 * * (06:00 UTC on the first day of the month) — configured in vercel.json.
// Auth: Vercel Cron sends Authorization: Bearer {CRON_SECRET}; same secret used for manual curl tests.
// Shares its compiler/template/send logic with the weekly-cadence cron
// (src/app/api/cron/digest-weekly/route.ts) via DigestSendService.runDigestCadence -
// one mechanism, cadence resolved per-member, not two parallel systems.

import { NextRequest, NextResponse } from 'next/server';
import { runDigestCadence } from '@/services/DigestSendService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/digest] CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server misconfiguration: CRON_SECRET not set' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDigestCadence('monthly', request.nextUrl.origin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/digest] failed:', err);
    return NextResponse.json({ error: 'Failed to run monthly digest' }, { status: 500 });
  }
}
