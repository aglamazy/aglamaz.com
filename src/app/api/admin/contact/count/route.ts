import { withMemberGuard } from '@/lib/withMemberGuard';
import { contactRepository } from '@/repositories/ContactRepository';

export const dynamic = 'force-dynamic';

const handler = async (req: Request, _ctx: any) => {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId') ?? undefined;
    const count = await contactRepository.countMessages(siteId);
    return Response.json({ count });
  } catch (error) {
    console.error('contact messages count error', error);
    return Response.json({ error: 'Failed to fetch contact messages count' }, { status: 500 });
  }
};

export const GET = withMemberGuard(handler);
