import { withMemberGuard } from '@/lib/withMemberGuard';
import { GuardContext } from '@/app/api/types';
import { browseDropboxFolder, getDropboxThumbnails } from '@/services/DropboxService';

export const dynamic = 'force-dynamic';

/**
 * Parse Dropbox URL/path input into a browse path and optional shared link URL.
 */
function parseDropboxInput(url: string | undefined, path: string) {
  let browsePath = path || '';
  let sharedUrl: string | undefined;

  if (url && typeof url === 'string') {
    if (url.startsWith('https://www.dropbox.com/home/') || url.startsWith('https://dropbox.com/home/')) {
      try {
        const urlObj = new URL(url);
        const extractedPath = '/' + decodeURIComponent(urlObj.pathname.replace(/^\/home\//, ''));
        if (!browsePath) browsePath = extractedPath;
      } catch {
        throw new Error('Invalid Dropbox URL');
      }
    } else if (url.startsWith('https://www.dropbox.com/') || url.startsWith('https://dropbox.com/')) {
      sharedUrl = url;
    } else if (url.startsWith('/')) {
      if (!browsePath) browsePath = url;
    } else {
      throw new Error('Invalid Dropbox URL or path');
    }
  }

  return { browsePath, sharedUrl };
}

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
    const { url, path, cursor, thumbnailPaths } = body;

    let parsedInput: { browsePath: string; sharedUrl: string | undefined };
    try {
      parsedInput = parseDropboxInput(url, path);
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
    const { browsePath, sharedUrl } = parsedInput;

    // ── Thumbnail-only mode ─────────────────────────────────────────
    if (Array.isArray(thumbnailPaths) && thumbnailPaths.length > 0) {
      const thumbnails = await getDropboxThumbnails(thumbnailPaths, sharedUrl);
      const result = Object.fromEntries(
        thumbnails.map((t) => [t.path, `data:image/jpeg;base64,${t.thumbnail}`])
      );
      return Response.json({ thumbnails: result });
    }

    // ── Browse mode (no thumbnails — fast) ──────────────────────────
    const result = await browseDropboxFolder(
      browsePath,
      cursor || undefined,
      sharedUrl,
    );

    // When using shared links, Dropbox returns absolute paths (e.g. /RootFolder/Sub/file.jpg).
    // We need to strip the shared folder root so the client only sees relative paths,
    // since the Dropbox API expects relative paths for shared link operations.
    //
    // Detection: if we browsed with relative path "/Sub", and Dropbox returned
    // "/RootFolder/Sub/file.jpg", the root is "/RootFolder".
    // If we browsed root (""), the root is the first path component of entries.
    let sharedRootPrefix = '';
    if (sharedUrl && result.entries.length > 0) {
      const firstPath = result.entries[0].path;
      if (!browsePath) {
        // Root browse: root prefix is the first path component
        const firstSlash = firstPath.indexOf('/', 1);
        if (firstSlash > 0) {
          sharedRootPrefix = firstPath.substring(0, firstSlash);
        }
      } else {
        // Subfolder browse: find where our browsePath appears in the returned absolute path
        const idx = firstPath.toLowerCase().indexOf(browsePath.toLowerCase());
        if (idx > 0) {
          sharedRootPrefix = firstPath.substring(0, idx);
        }
      }
    }

    const stripPrefix = (p: string) => {
      if (sharedRootPrefix && p.toLowerCase().startsWith(sharedRootPrefix.toLowerCase())) {
        return p.substring(sharedRootPrefix.length) || '/';
      }
      return p;
    };

    const entries = result.entries.map((e) => ({
      name: e.name,
      path: stripPrefix(e.path),
      // Keep original Dropbox path for thumbnail fetching
      dropboxPath: e.path,
      isFolder: e.isFolder,
      size: e.size,
    }));

    // Derive a human-readable folder name for the root being browsed
    let folderName: string | undefined;
    if (sharedRootPrefix) {
      // Shared link: root prefix is the shared folder's name
      folderName = sharedRootPrefix.replace(/^\//, '');
    } else if (browsePath) {
      // Direct path: last segment of the path
      const segments = browsePath.split('/').filter(Boolean);
      if (segments.length > 0) {
        folderName = decodeURIComponent(segments[segments.length - 1]);
      }
    }

    return Response.json({
      entries,
      hasMore: result.hasMore,
      cursor: result.cursor,
      folderName,
    });
  } catch (error) {
    console.error('[dropbox/browse]', error);
    const message = error instanceof Error ? error.message : 'Failed to browse Dropbox';
    return Response.json({ error: message }, { status: 500 });
  }
};

export const POST = withMemberGuard(postHandler);
