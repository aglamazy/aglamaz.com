import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { processAndUploadImage } from '@/services/ServerImageProcessor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const postHandler = async (request: Request, context: GuardContext & { params: Promise<{ siteId: string }> }) => {
  try {
    const params = await context.params;
    const siteId = params?.siteId;

    if (!siteId) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    if (context.member?.siteId !== siteId) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'missing_file' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ error: 'file_too_large' }, { status: 400 });
    }

    const userId = context.user!.sub || context.user!.userId;
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `content-images/${siteId}/${userId}/${Date.now()}_${crypto.randomUUID()}.webp`;
    const result = await processAndUploadImage(buffer, storagePath);

    return Response.json({ url: result.url, width: result.width, height: result.height });
  } catch (error) {
    console.error('[content-images] upload failed', error);
    return Response.json({ error: 'upload_failed' }, { status: 500 });
  }
};

export const POST = withMemberGuard(postHandler);
