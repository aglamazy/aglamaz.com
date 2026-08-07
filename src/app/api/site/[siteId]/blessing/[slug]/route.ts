import { NextRequest } from 'next/server';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';

export const dynamic = 'force-dynamic';

// Test-only injection hooks, mirroring the __setMock* convention used by
// blessing-pages/[blessingPageId]/blessings/public/route.ts.
let blessingPageRepoOverride: BlessingPageRepository | null = null;
let anniversaryRepoOverride: AnniversaryRepository | null = null;

export function __setMockBlessingPageRepository(repo: BlessingPageRepository | null) {
  blessingPageRepoOverride = repo;
}
export function __setMockAnniversaryRepository(repo: AnniversaryRepository | null) {
  anniversaryRepoOverride = repo;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ siteId: string; slug: string }> | { siteId: string; slug: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { siteId, slug } = resolvedParams;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (!slug) {
      return Response.json({ error: 'Slug is required' }, { status: 400 });
    }

    // Get blessing page by slug
    const blessingPageRepo = blessingPageRepoOverride ?? new BlessingPageRepository();
    const blessingPage = await blessingPageRepo.getBySlug(slug);

    // This route is unauthenticated (no member guard) - it must only ever
    // surface pages the owner explicitly marked public, and must respond
    // identically to "not found" and "found but private" so a slug's
    // existence/privacy can't be probed from the response shape.
    if (!blessingPage || blessingPage.siteId !== siteId || !blessingPage.isPublic) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get the associated event
    const anniversaryRepo = anniversaryRepoOverride ?? new AnniversaryRepository();
    const event = await anniversaryRepo.getById(blessingPage.eventId);

    if (!event || event.siteId !== siteId) {
      return Response.json({ error: 'Associated event not found' }, { status: 404 });
    }

    return Response.json({
      blessingPage,
      event,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch blessing page' }, { status: 500 });
  }
}
