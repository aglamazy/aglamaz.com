import { withMemberGuard } from '@/lib/withMemberGuard';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { BlessingRepository } from '@/repositories/BlessingRepository';
import { MemberRepository } from '@/repositories/MemberRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};

    // Verify blessing page exists and belongs to member's site
    const bpRepo = new BlessingPageRepository();
    const blessingPage = await bpRepo.getById(id!);
    if (!blessingPage || blessingPage.siteId !== member.siteId) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get locale from header
    const locale = request.headers.get('x-locale') || undefined;

    // Fetch blessings
    const blessingRepo = new BlessingRepository();
    const blessings = await blessingRepo.listByBlessingPage(id!, locale);

    return Response.json({ blessings });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch blessings' }, { status: 500 });
  }
};

const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const user = context.user!;
    const member = context.member!;
    const params = context.params instanceof Promise ? await context.params : context.params;
    const { id } = params ?? {};
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return Response.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify blessing page exists and belongs to member's site
    const bpRepo = new BlessingPageRepository();
    const blessingPage = await bpRepo.getById(id!);
    if (!blessingPage || blessingPage.siteId !== member.siteId) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get member details for author name
    const memberRepo = new MemberRepository();
    const memberDetails = await memberRepo.getByUid(member.siteId, member.uid);
    const authorName = memberDetails?.displayName || user.email || 'Anonymous';

    // Get locale from header
    const locale = request.headers.get('x-locale') || 'he';

    // Create blessing
    const blessingRepo = new BlessingRepository();
    const blessing = await blessingRepo.create({
      blessingPageId: id!,
      siteId: member.siteId,
      authorId: user.userId,
      authorName,
      content,
      locale,
    });

    return Response.json({ blessing }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create blessing' }, { status: 500 });
  }
};

export const GET = withMemberGuard(getHandler);
export const POST = withMemberGuard(postHandler);
