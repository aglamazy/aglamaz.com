import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { downloadDropboxFile, expandFoldersToImagePaths, MAX_IMPORT_IMAGES } from '@/services/DropboxService';
import { processAndUploadImage } from '@/services/ServerImageProcessor';
import { AnniversaryOccurrenceRepository } from '@/repositories/AnniversaryOccurrenceRepository';
import type { ImageWithDimension } from '@/entities/ImageWithDimension';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

    const body = await request.json();
    const { dropboxUrl, paths, folderPaths, target } = body;

    // Determine if dropboxUrl is a shared link or a /home/ URL
    let sharedUrl: string | undefined;
    if (dropboxUrl && typeof dropboxUrl === 'string') {
      if (dropboxUrl.startsWith('https://www.dropbox.com/home/') || dropboxUrl.startsWith('https://dropbox.com/home/') || dropboxUrl.startsWith('/')) {
        // /home/ URL or direct path — not a shared link, files are accessed by absolute path
        sharedUrl = undefined;
      } else if (dropboxUrl.startsWith('https://')) {
        sharedUrl = dropboxUrl;
      }
    }

    // Validate request. Either files, folders, or both (famcircle#194).
    const filePaths: string[] = Array.isArray(paths) ? paths.filter((p) => typeof p === 'string' && p) : [];
    const selectedFolders: string[] = Array.isArray(folderPaths)
      ? folderPaths.filter((p) => typeof p === 'string' && p)
      : [];

    if (filePaths.length === 0 && selectedFolders.length === 0) {
      return Response.json({ error: 'No paths provided' }, { status: 400 });
    }

    // Expand selected folders into the images inside them, and refuse a run that
    // cannot finish inside maxDuration rather than losing it at 300s.
    let expandedPaths: string[];
    try {
      const fromFolders = selectedFolders.length > 0
        ? await expandFoldersToImagePaths(selectedFolders, sharedUrl)
        : [];
      expandedPaths = Array.from(new Set([...filePaths, ...fromFolders]));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read the selected folders';
      return Response.json({ error: message }, { status: 400 });
    }

    if (expandedPaths.length === 0) {
      return Response.json({ error: 'The selected folders hold no images' }, { status: 400 });
    }

    if (expandedPaths.length > MAX_IMPORT_IMAGES) {
      return Response.json({
        error: `This selection holds ${expandedPaths.length} images, more than one import can finish before the `
          + `server gives up (limit ${MAX_IMPORT_IMAGES}). Select fewer folders and import them in batches.`,
      }, { status: 400 });
    }

    if (!target?.anniversaryId || !target?.occurrenceId) {
      return Response.json({ error: 'Invalid target' }, { status: 400 });
    }

    // Verify occurrence exists and belongs to this site
    const occRepo = new AnniversaryOccurrenceRepository();
    const occ = await occRepo.getById(target.occurrenceId);
    if (!occ || occ.siteId !== siteId) {
      return Response.json({ error: 'Occurrence not found' }, { status: 404 });
    }

    if (occ.eventId !== target.anniversaryId) {
      return Response.json({ error: 'Occurrence does not belong to this anniversary' }, { status: 400 });
    }

    const userId = context.user!.sub || context.user!.userId;
    const timestamp = Date.now();
    const total = expandedPaths.length;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const results: (ImageWithDimension | null)[] = new Array(total).fill(null);
        const errors: string[] = [];
        let completed = 0;

        function sendProgress() {
          completed++;
          controller.enqueue(encoder.encode(JSON.stringify({ completed, total }) + '\n'));
        }

        // Process images with sliding-window concurrency (4 at a time)
        const CONCURRENCY = 4;
        let nextIndex = 0;

        async function processOne() {
          while (nextIndex < total) {
            const i = nextIndex++;
            const filePath = expandedPaths[i];
            try {
              const buffer = await downloadDropboxFile(filePath, sharedUrl);
              const storagePath = `anniversaries/${userId}/events/${target.anniversaryId}/${target.occurrenceId}/dropbox_${timestamp}_${i}.webp`;
              const result = await processAndUploadImage(buffer, storagePath);
              results[i] = { url: result.url, width: result.width, height: result.height };
            } catch (err) {
              console.error(`[dropbox/import] Failed to process ${filePath}:`, err);
              errors.push(filePath);
            }
            sendProgress();
          }
        }

        await Promise.all(Array.from({ length: CONCURRENCY }, () => processOne()));
        const newImages = results.filter(Boolean) as ImageWithDimension[];

        // Merge with existing images
        const existingImages = occ.imagesWithDimensions || [];
        const merged = [...existingImages, ...newImages];

        // Update occurrence
        await occRepo.update(target.occurrenceId, {
          imagesWithDimensions: merged,
          ...(dropboxUrl ? { importSource: { url: dropboxUrl, type: 'dropbox' as const } } : {}),
        });

        // Send final result
        controller.enqueue(encoder.encode(JSON.stringify({
          done: true,
          imported: newImages.length,
          failed: errors.length,
          images: newImages,
          errors: errors.length > 0 ? errors : undefined,
        }) + '\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  } catch (error) {
    console.error('[dropbox/import]', error);
    const message = error instanceof Error ? error.message : 'Failed to import from Dropbox';
    return Response.json({ error: message }, { status: 500 });
  }
};

export const POST = withMemberGuard(postHandler);
