import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { BlessingRepository } from '@/repositories/BlessingRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { GuardContext } from '@/app/api/types';
import { TagNotificationService } from '@/services/TagNotificationService';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; blessingPageId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const blessingPageId = params?.blessingPageId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!blessingPageId) {
      return Response.json({ error: 'Blessing Page ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify blessing page exists and belongs to member's site
    const bpRepo = new BlessingPageRepository();
    const blessingPage = await bpRepo.getById(blessingPageId);
    if (!blessingPage || blessingPage.siteId !== siteId) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get locale from header
    const locale = request.headers.get('x-locale') || undefined;

    // Fetch blessings
    const blessingRepo = new BlessingRepository();
    const blessings = await blessingRepo.listByBlessingPage(blessingPageId, locale);

    return Response.json({ blessings });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch blessings' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string; blessingPageId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;
    const blessingPageId = params?.blessingPageId;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!blessingPageId) {
      return Response.json({ error: 'Blessing Page ID is required' }, { status: 400 });
    }

    // Verify member has access to this site
    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = context.user!;
    const member = context.member!;
    const body = await request.json();
    const { content, taggedMemberIds, visibleToPublic } = body;

    if (!content || !content.trim()) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }

    if (visibleToPublic !== undefined && typeof visibleToPublic !== 'boolean') {
      return Response.json({ error: 'visibleToPublic must be a boolean' }, { status: 400 });
    }

    // Verify blessing page exists and belongs to member's site
    const bpRepo = new BlessingPageRepository();
    const blessingPage = await bpRepo.getById(blessingPageId);
    if (!blessingPage || blessingPage.siteId !== siteId) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get member details for author name
    const memberRepo = new MemberRepository();
    const memberDetails = await memberRepo.getByUid(member.siteId, member.uid);
    const authorName = memberDetails?.displayName || user.email || 'Anonymous';

    // Get locale from header
    const locale = request.headers.get('x-locale') || 'he';

    const validTaggedMemberIds = await TagNotificationService.filterSiteMemberIds(taggedMemberIds, siteId);

    // Create blessing
    const blessingRepo = new BlessingRepository();
    const blessing = await blessingRepo.create({
      blessingPageId: blessingPageId,
      siteId: siteId,
      authorId: user.userId,
      authorName,
      content,
      locale,
      taggedMemberIds: validTaggedMemberIds,
      visibleToPublic: visibleToPublic === true,
    });

    if (validTaggedMemberIds.length) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
      await TagNotificationService.notifyTaggedMembers({
        siteId,
        taggedMemberIds: validTaggedMemberIds,
        taggedByMemberId: user.userId,
        taggedByName: authorName,
        contentType: 'blessing',
        contentLink: `${appUrl}/app/blessing/${blessingPage.slug}`,
      }).catch((err) => console.error('[blessings] tag notification failed:', err));
    }

    return Response.json({ blessing }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create blessing' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
