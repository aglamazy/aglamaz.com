import { withMemberGuard } from "@/lib/withMemberGuard";
import { NextResponse } from 'next/server';


export function withAdminGuard(handler: Function) {
  return withMemberGuard(async (req: Request, context: any) => {
    if (context.member.role !== "admin") {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    return handler(req, context);

  });
}
