// TEMPORARY - for composing the honoree-invite email template live against real site
// data (Agla, 2026-07-22). Remove once the format is settled. Renders the exact HTML
// BlessingInviteTemplateService produces - real template code, placeholder invite URL
// (the invite-link backend extension isn't wired yet - this route is for reviewing the
// email content/design first, per Agla's request).
import { withMemberGuard } from '@/lib/withMemberGuard';
import { buildHonoreeInviteEmail } from '@/services/BlessingInviteTemplateService';
import { resolveDigestSiteName } from '@/services/DigestTemplateService';
import { SiteRepository } from '@/repositories/SiteRepository';
import { getPath } from '@/utils/urls';
import { AppRoute } from '@/entities/Routes';
import { GuardContext } from '@/app/api/types';
import type { AnniversaryType } from '@/entities/Anniversary';

export const dynamic = 'force-dynamic';

const LOCALE = 'he';

const getHandler = async (request: Request, context: GuardContext) => {
  const params = await context.params;
  const siteId = params?.siteId as string;
  if (!siteId || context.member?.siteId !== siteId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const eventType = (url.searchParams.get('type') as AnniversaryType) || 'birthday';
  const honoreeName = url.searchParams.get('honoreeName') || 'שקד אגלמז';

  const siteRepo = new SiteRepository();
  const site = await siteRepo.get(siteId);
  if (!site) return Response.json({ error: 'Site not found' }, { status: 404 });

  const siteName = resolveDigestSiteName(site, LOCALE, siteId);
  const member = context.member as { firstName?: string; displayName?: string; email?: string };
  const authorName = member.firstName || member.displayName || member.email || 'משפחה';
  const inviteUrl = new URL(getPath(AppRoute.AUTH_INVITE, { token: 'PREVIEW-TOKEN' }), url.origin).toString();

  const { html } = buildHonoreeInviteEmail({
    locale: LOCALE,
    siteName,
    honoreeName,
    authorName,
    eventType,
    inviteUrl,
  });

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
};

export const GET = withMemberGuard(getHandler);
