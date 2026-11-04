// TEMP famcircle#179 (Agla 2026-11-04, msg 105659): open debug report for the Android Chrome
// reopen login. POST is open (the gate calls it while logged out); GET is admin-only and is
// how the reports are read. Remove this route, its repository and the gate's report call once
// the cause is known.
import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/withAdminGuard';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { DebugAuthReportRepository } from '@/repositories/DebugAuthReportRepository';
import { parseDebugAuthReport } from '@/utils/debugAuthReport';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const parsed = parseDebugAuthReport(await req.text());
  if (parsed.ok === false) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const id = await new DebugAuthReportRepository().record(parsed.report, {
    ua: (req.headers.get('user-agent') ?? 'none').slice(0, 512),
    host: (req.headers.get('host') ?? 'none').slice(0, 128),
    accessCookiePresent: Boolean(req.cookies.get(ACCESS_TOKEN)?.value),
    cookieCount: req.cookies.getAll().length,
  });
  return NextResponse.json({ ok: true, id });
}

export const GET = withAdminGuard(async (req: Request) => {
  const raw = new URL(req.url).searchParams.get('limit');
  const limit = raw === null ? 100 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    return NextResponse.json({ error: 'limit must be an integer 1..500' }, { status: 400 });
  }
  const reports = await new DebugAuthReportRepository().listRecent(limit);
  return NextResponse.json({ count: reports.length, reports });
});
