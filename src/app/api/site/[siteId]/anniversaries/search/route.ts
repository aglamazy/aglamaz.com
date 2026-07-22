import { withReadableGuard } from '@/lib/withReadableGuard';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

const getHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const locale = request.headers.get('x-locale') || undefined;

    const repo = new AnniversaryRepository();
    const events = await repo.searchByName(siteId, query, locale);
    return Response.json({ events });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to search events' }, { status: 500 });
  }
};

export const GET = withReadableGuard(getHandler);
