import {withMemberGuard} from "@/lib/withMemberGuard";

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: any, user: any, member: any) => {
  try {
    if (!member) {
      return Response.json({ error: 'Member not found' }, { status: 404 });
    }
    return Response.json({ success: true, member });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch member info' }, { status: 500 });
  }
};

export const GET = withMemberGuard(handler);