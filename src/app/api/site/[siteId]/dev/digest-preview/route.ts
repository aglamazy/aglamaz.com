// TEMPORARY - for composing the digest email template live against real site data
// (Agla, 2026-07-21). Remove once the format is settled. Renders the exact HTML
// DigestTemplateService produces - no mock data, real compiler + real template code.
import { withMemberGuard } from '@/lib/withMemberGuard';
import { DigestCompilerService } from '@/services/DigestCompilerService';
import { DigestTemplateService, resolveDigestSiteName } from '@/services/DigestTemplateService';
import { SiteRepository } from '@/repositories/SiteRepository';
import { getPath } from '@/utils/urls';
import { AppRoute } from '@/entities/Routes';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const LOCALE = 'he';

const getHandler = async (request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const cadence = url.searchParams.get('cadence') === 'weekly' ? 'weekly' : 'monthly';

  const siteRepo = new SiteRepository();
  const compiler = new DigestCompilerService();
  const site = await siteRepo.get(siteId);
  if (!site) return Response.json({ error: 'Site not found' }, { status: 404 });

  const siteName = resolveDigestSiteName(site, LOCALE, siteId);
  const member = context.member as { firstName?: string; displayName?: string; email?: string };
  const recipientName = member.firstName || member.displayName || member.email || 'משפחה';
  const calendarUrl = new URL(getPath(AppRoute.APP_CALENDAR), url.origin).toString();
  const galleryUrl = new URL(getPath(AppRoute.APP_PHOTOS), url.origin).toString();

  const html =
    cadence === 'weekly'
      ? DigestTemplateService.buildWeeklyDigestEmail(
          await compiler.compileDigestForRange(
            siteId,
            new Date(),
            new Date(new Date().setDate(new Date().getDate() + 7)),
            { locale: LOCALE },
          ),
          { locale: LOCALE, siteName, recipientName, calendarUrl, galleryUrl },
        ).html
      : DigestTemplateService.buildMonthlyDigestEmail(
          await compiler.compileMonthlyDigest(siteId, new Date(), { locale: LOCALE }),
          { locale: LOCALE, siteName, recipientName, calendarUrl, galleryUrl },
        ).html;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};

export const GET = withMemberGuard(getHandler);
