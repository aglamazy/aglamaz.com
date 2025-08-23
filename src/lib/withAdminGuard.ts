import { withMemberGuard } from "@/lib/withMemberGuard";
import { NextResponse } from 'next/server';
import { GuardContext, RouteHandler } from '@/app/api/types';

export function withAdminGuard(handler: RouteHandler): RouteHandler {
  return withMemberGuard(async (req: Request, context: GuardContext) => {
    if (!context.member || context.member.role !== "admin") {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    return handler(req, context);
  });
}
