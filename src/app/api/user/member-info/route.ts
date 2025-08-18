import {withMemberGuard} from "@/lib/withMemberGuard";
import { GuardContext, RouteHandler } from "@/app/api/types";

export const dynamic = 'force-dynamic';

const handler: RouteHandler = async (request: Request, context: GuardContext) => {
  try {
    const { member } = context;

    if (!member) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }
    return Response.json({ success: true, member });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch member info' }, { status: 500 });
  }
};

export const GET = withMemberGuard(handler);