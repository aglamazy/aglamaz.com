// RETIRED — famcircle#56 (2026-07-21)
//
// This cron (7-day birthday + 30-day yahrzeit lead-time email reminders) has been
// replaced by:
//   • famcircle#53 — Weekly rolling-window digest (vercel.json: /api/cron/digest?cadence=weekly)
//   • famcircle#54 — In-day reminders cron (/api/cron/in-day-reminders)
//
// The vercel.json entry for /api/cron/reminders has been removed so Vercel will no
// longer schedule this endpoint.  The route is kept as a stub to safely absorb any
// in-flight or manually-triggered calls during the cutover window.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      retired: true,
      message:
        'This cron is retired (famcircle#56). ' +
        'Advance-notice reminders are now sent via the weekly digest (/api/cron/digest?cadence=weekly). ' +
        'Day-of reminders are sent via /api/cron/in-day-reminders.',
    },
    { status: 410 },
  );
}
