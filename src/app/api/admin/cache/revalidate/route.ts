import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';
import { SiteRepository } from '@/repositories/SiteRepository';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cache/revalidate
 * Manually revalidate all site caches (admin only)
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const siteId = context.member?.siteId || process.env.NEXT_SITE_ID;

    if (!siteId) {
      return Response.json({ error: 'Site ID not configured' }, { status: 500 });
    }

    const repository = new SiteRepository();
    await repository.revalidateSite(siteId);

    return Response.json({
      success: true,
      message: 'Cache cleared successfully',
      siteId
    });
  } catch (error) {
    console.error('[cache/revalidate] POST error:', error);
    return Response.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
};

export const POST = withAdminGuard(postHandler);
