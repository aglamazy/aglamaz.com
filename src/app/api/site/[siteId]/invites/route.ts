import { withAdminGuard } from '@/lib/withAdminGuard';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import type { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const handler = async (request: Request, context: GuardContext) => {
  try {
    const { siteId } = context.params ?? {};
    if (!siteId) {
      return Response.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const familyRepository = new FamilyRepository();
    const inviterId = context.member?.uid || context.user?.userId || '';
    const inviterEmail = (context.member as any)?.email || undefined;
    const inviterName = (context.member as any)?.firstName || context.user?.firstName || undefined;

    const invite = await familyRepository.createInvite(siteId, {
      id: inviterId,
      email: inviterEmail,
      name: inviterName,
    });

    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
    const url = `${baseUrl.replace(/\/$/, '')}/invite/${invite.token}`;

    return Response.json({
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt.toDate().toISOString(),
        createdAt: invite.createdAt.toDate().toISOString(),
      },
      url,
    });
  } catch (error) {
    console.error('Failed to create invite', error);
    return Response.json({ error: 'Failed to create invite' }, { status: 500 });
  }
};

export const POST = withAdminGuard(handler);
