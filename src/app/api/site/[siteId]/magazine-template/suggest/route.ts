import { MagazineTemplateSuggesterService } from '@/services/MagazineTemplateSuggesterService';
import { FIXTURE_MAGAZINE_SUGGEST_INPUT } from '@/services/fixtures/magazineTemplateFixture';
import { withAdminGuard } from '@/lib/withAdminGuard';
import { GuardContext } from '@/app/api/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/site/[siteId]/magazine-template/suggest
 * Drafts a starting HTML template via OpenAI for the editor to review/edit.
 * v0 drafts from a fixture (no real sent digests exist yet - famcircle#7 wires
 * this to real historical digests later).
 */
const postHandler = async (request: Request, context: GuardContext) => {
  try {
    const params = context.params instanceof Promise ? await context.params : context.params;
    const siteId = params?.siteId as string;

    if (!siteId) {
      return Response.json({ error: 'Site ID is required' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!MagazineTemplateSuggesterService.isEnabled()) {
      return Response.json({ error: 'Template suggester service disabled' }, { status: 503 });
    }

    const html = await MagazineTemplateSuggesterService.suggestTemplate(FIXTURE_MAGAZINE_SUGGEST_INPUT);

    return Response.json({ html });
  } catch (error) {
    console.error('[magazine-template-suggest] POST error:', error);
    return Response.json({ error: 'Failed to suggest magazine template' }, { status: 500 });
  }
};

export const POST = withAdminGuard(postHandler);
