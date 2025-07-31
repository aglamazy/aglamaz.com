import { withAdminGuard } from '@/lib/withAdminGuard';
import { contactRepository } from '@/repositories/ContactRepository';

const handler = async (_req: Request, _ctx: any) => {
  try {
    const messages = await contactRepository.getAllMessages();
    return Response.json({ messages });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
};

export const GET = withAdminGuard(handler);
