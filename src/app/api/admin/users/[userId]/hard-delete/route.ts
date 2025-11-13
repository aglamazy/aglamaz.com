import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { adminAuth, initAdmin } from '@/firebase/admin';
import { MemberRepository } from '@/repositories/MemberRepository';

export const dynamic = 'force-dynamic';

/**
 * Hard delete a user - for testing and GDPR compliance
 * Minimum implementation: Delete Firebase auth + member document
 */
async function deleteHandler(
  request: NextRequest,
  context: GuardContext
): Promise<NextResponse> {
  const { member, params } = context;
  const resolvedParams = await params;
  const userId = resolvedParams?.userId as string;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === member.uid) {
    return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  }

  try {
    initAdmin();
    const auth = adminAuth();
    const memberRepo = new MemberRepository();

    // Delete Firebase auth user
    try {
      await auth.deleteUser(userId);
    } catch (authError: any) {
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
      // Continue if user already deleted from auth
    }

    // Delete member document using repository
    const targetMember = await memberRepo.getByUid(member.siteId, userId);
    const deletedDocs: string[] = [];

    if (targetMember) {
      await memberRepo.delete(targetMember.id);
      deletedDocs.push(`member/${targetMember.id}`);
    }

    return NextResponse.json({
      success: true,
      deleted: {
        firebaseAuth: true,
        documents: deletedDocs,
      },
      message: 'User hard deleted successfully',
    });
  } catch (error) {
    console.error('Hard delete failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const DELETE = withAdminGuard(deleteHandler);
