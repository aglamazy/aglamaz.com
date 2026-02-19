/**
 * Dropbox API service
 *
 * Wraps Dropbox HTTP API for browsing folders, fetching thumbnails,
 * and downloading files. Uses app-level OAuth refresh token flow.
 */

// ── Interfaces ──────────────────────────────────────────────────────

export interface DropboxEntry {
  name: string;
  path: string;
  isFolder: boolean;
  size?: number;
}

export interface DropboxBrowseResult {
  entries: DropboxEntry[];
  cursor?: string;
  hasMore: boolean;
}

export interface DropboxThumbnailResult {
  path: string;
  thumbnail: string; // base64
}

// ── Token Management ────────────────────────────────────────────────

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function getDropboxCredentials() {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

  if (!appKey || !appSecret || !refreshToken) {
    throw new Error(
      'Missing required Dropbox environment variables:\n' +
      '  DROPBOX_APP_KEY, DROPBOX_APP_SECRET, and DROPBOX_REFRESH_TOKEN must be set.'
    );
  }

  return { appKey, appSecret, refreshToken };
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const { appKey, appSecret, refreshToken } = getDropboxCredentials();

  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedAccessToken!;
}

// ── Folder Browsing ─────────────────────────────────────────────────

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif', '.heic', '.heif',
]);

function isImageFile(name: string): boolean {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Browse a Dropbox folder by path. Returns image files and subfolders.
 * Uses shared_link if provided, otherwise direct path access.
 */
export async function browseDropboxFolder(
  path: string,
  cursor?: string,
  sharedUrl?: string,
): Promise<DropboxBrowseResult> {
  const accessToken = await getAccessToken();

  let res: Response;

  if (cursor) {
    // Continue pagination
    res = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor }),
    });
  } else {
    // Initial listing
    const body: Record<string, any> = {
      path: path || '',
      limit: 100,
    };
    if (sharedUrl) {
      body.shared_link = { url: sharedUrl };
    }

    res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    console.error('[DropboxService] list_folder error:', res.status, text);
    console.error('[DropboxService] request was:', JSON.stringify({ path, cursor: !!cursor, sharedUrl: !!sharedUrl }));
    throw new Error(`Dropbox list_folder failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  const entries: DropboxEntry[] = (data.entries || [])
    .filter((e: any) => e['.tag'] === 'folder' || (e['.tag'] === 'file' && isImageFile(e.name)))
    .map((e: any) => ({
      name: e.name,
      path: e.path_display || e.path_lower,
      isFolder: e['.tag'] === 'folder',
      size: e.size,
    }));

  return {
    entries,
    cursor: data.has_more ? data.cursor : undefined,
    hasMore: data.has_more || false,
  };
}

// ── Thumbnails ──────────────────────────────────────────────────────

/**
 * Fetch thumbnails for a batch of image paths (max 25 per call).
 * Returns base64-encoded JPEG thumbnails.
 */
export async function getDropboxThumbnails(
  paths: string[],
  sharedUrl?: string,
): Promise<DropboxThumbnailResult[]> {
  if (paths.length === 0) return [];

  const accessToken = await getAccessToken();
  const results: DropboxThumbnailResult[] = [];

  // Process in batches of 25 (Dropbox API limit)
  for (let i = 0; i < paths.length; i += 25) {
    const batch = paths.slice(i, i + 25);

    const entries = batch.map((p) => {
      if (sharedUrl) {
        return {
          path: p,
          format: { '.tag': 'jpeg' },
          size: { '.tag': 'w256h256' },
          mode: { '.tag': 'bestfit' },
        };
      }
      return {
        path: p,
        format: { '.tag': 'jpeg' },
        size: { '.tag': 'w256h256' },
        mode: { '.tag': 'bestfit' },
      };
    });

    const res = await fetch('https://content.dropboxapi.com/2/files/get_thumbnail_batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entries }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[DropboxService] get_thumbnail_batch failed (${res.status}): ${text}`);
      continue;
    }

    const data = await res.json();
    for (const entry of data.entries || []) {
      if (entry['.tag'] === 'success') {
        const metadata = entry.metadata;
        results.push({
          path: metadata.path_display || metadata.path_lower,
          thumbnail: entry.thumbnail,
        });
      }
    }
  }

  return results;
}

// ── File Download ───────────────────────────────────────────────────

/**
 * Download a single file from Dropbox. Returns the raw Buffer.
 */
export async function downloadDropboxFile(
  path: string,
  sharedUrl?: string,
): Promise<Buffer> {
  const accessToken = await getAccessToken();

  const apiArg: Record<string, any> = { path };
  // Dropbox-API-Arg header must be ASCII-safe; escape non-ASCII chars
  const toAsciiSafe = (s: string) =>
    s.replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

  if (sharedUrl) {
    // When using shared link, we need to use the sharing endpoint
    const apiArg = toAsciiSafe(JSON.stringify({ url: sharedUrl, path }));
    console.log('[DropboxService] download shared file, path:', path);
    const res = await fetch('https://content.dropboxapi.com/2/sharing/get_shared_link_file', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': apiArg,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[DropboxService] download (shared) failed:', res.status, text);
      throw new Error(`Dropbox download (shared) failed (${res.status}): ${text}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }

  // Direct path download
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': toAsciiSafe(JSON.stringify(apiArg)),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropbox download failed (${res.status}): ${text}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
