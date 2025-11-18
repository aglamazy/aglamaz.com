import { NextRequest } from 'next/server';
import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const { slug } = resolvedParams;

    // Get blessing page by slug
    const blessingPageRepo = new BlessingPageRepository();
    const blessingPage = await blessingPageRepo.getBySlug(slug);

    if (!blessingPage) {
      return Response.json({ error: 'Blessing page not found' }, { status: 404 });
    }

    // Get the associated event
    const anniversaryRepo = new AnniversaryRepository();
    const event = await anniversaryRepo.getById(blessingPage.eventId);

    if (!event) {
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
