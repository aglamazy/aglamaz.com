import { contactRepository } from '@/repositories/ContactRepository';
import {withMemberGuard} from "@/lib/withMemberGuard";

export const dynamic = 'force-dynamic';

const handler = async (_req: Request, _ctx: any) => {
  try {
    const messages = await contactRepository.getAllMessages();
    return Response.json({ messages });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
};

export const GET = withMemberGuard(handler);
