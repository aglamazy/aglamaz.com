'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute, getApiPath } from '@/utils/urls';
import { useSiteStore } from '@/store/SiteStore';
import { useTranslation } from 'react-i18next';
import type { ImageWithDimension } from '@/entities/ImageWithDimension';
import type { ImportSourceLink } from '@/entities/ImportSourceLink';

interface DropboxImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (images: ImageWithDimension[]) => void;
  target: { anniversaryId: string; occurrenceId: string };
  previousLinks?: ImportSourceLink[];
}

interface BrowseEntry {
  name: string;
  path: string;
  dropboxPath?: string;
  isFolder: boolean;
  size?: number;
}

type ModalState = 'url-input' | 'browsing' | 'importing' | 'done';

/** Extract a friendly folder name from a Dropbox URL or path */
function getDropboxLabel(url: string): string | null {
  try {
    // Direct path like /Photos/Wedding
    if (url.startsWith('/')) {
      const segments = url.split('/').filter(Boolean);
      return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : 'Dropbox';
    }
    // /home/ URL like https://www.dropbox.com/home/Photos/Wedding
    const homeMatch = url.match(/dropbox\.com\/home\/(.+?)(?:\?|$)/);
    if (homeMatch) {
      const segments = homeMatch[1].split('/').filter(Boolean);
      return segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]) : 'Dropbox';
    }
    // Shared link — no meaningful name available
    return null;
  } catch {
    return null;
  }
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function ThumbnailCell({ src, alt }: { src?: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full aspect-square bg-gray-100 relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

export default function DropboxImportModal({ isOpen, onClose, onImported, target, previousLinks }: DropboxImportModalProps) {
  const { t, i18n } = useTranslation();
  const dir = i18n.dir();
  const [state, setState] = useState<ModalState>('url-input');
  const [dropboxUrl, setDropboxUrl] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importProgress, setImportProgress] = useState('');
  const [resolvedLabels, setResolvedLabels] = useState<Record<string, string>>({});
  const thumbnailRequestId = useRef(0);

  // Resolve display names for shared links from Dropbox
  useEffect(() => {
    if (!isOpen || !previousLinks?.length) return;
    const sharedLinks = previousLinks.filter(
      (l) => l.type === 'dropbox' && l.url.startsWith('https://'),
    );
    if (sharedLinks.length === 0) return;
    sharedLinks.forEach((link) => {
      if (resolvedLabels[link.url]) return; // already resolved
      apiFetch<{ folderName?: string }>(ApiRoute.SITE_DROPBOX_BROWSE, {
        method: 'POST',
        body: { url: link.url, path: '' },
      })
        .then((data) => {
          if (data.folderName) {
            setResolvedLabels((prev) => ({ ...prev, [link.url]: data.folderName! }));
          }
        })
        .catch(() => {});
    });
  }, [isOpen, previousLinks]);

  const reset = useCallback(() => {
    setState('url-input');
    setDropboxUrl('');
    setCurrentPath('');
    setPathHistory([]);
    setEntries([]);
    setThumbnails({});
    setSelected(new Set());
    setCursor(undefined);
    setHasMore(false);
    setLoading(false);
    setError('');
    setImportProgress('');
    thumbnailRequestId.current++;
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  async function fetchThumbnails(imageEntries: BrowseEntry[], effectiveUrl?: string) {
    const paths = imageEntries
      .filter((e) => !e.isFolder && e.dropboxPath)
      .map((e) => e.dropboxPath!);
    if (paths.length === 0) return;

    const urlForRequest = effectiveUrl ?? dropboxUrl;
    const requestId = ++thumbnailRequestId.current;

    // Fetch in batches of 25
    for (let i = 0; i < paths.length; i += 25) {
      if (thumbnailRequestId.current !== requestId) return; // stale

      const batch = paths.slice(i, i + 25);
      try {
        const data = await apiFetch<{ thumbnails: Record<string, string> }>(
          ApiRoute.SITE_DROPBOX_BROWSE,
          {
            method: 'POST',
            body: {
              url: urlForRequest || undefined,
              thumbnailPaths: batch,
            },
          },
        );
        if (thumbnailRequestId.current !== requestId) return; // stale
        setThumbnails((prev) => ({ ...prev, ...data.thumbnails }));
      } catch (err) {
        console.error('[DropboxImport] thumbnails failed:', err);
      }
    }
  }

  async function browse(path: string, paginationCursor?: string, urlOverride?: string) {
    const effectiveUrl = urlOverride ?? dropboxUrl;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<{
        entries: BrowseEntry[];
        hasMore: boolean;
        cursor?: string;
      }>(ApiRoute.SITE_DROPBOX_BROWSE, {
        method: 'POST',
        body: {
          url: effectiveUrl || undefined,
          path,
          cursor: paginationCursor,
        },
      });

      let allEntries: BrowseEntry[];
      if (paginationCursor) {
        allEntries = [...entries, ...data.entries];
        setEntries(allEntries);
      } else {
        allEntries = data.entries;
        setEntries(allEntries);
        setThumbnails({});
        setSelected(new Set());
      }

      setCursor(data.cursor);
      setHasMore(data.hasMore);
      setState('browsing');

      // Fetch thumbnails in background
      const newImages = paginationCursor ? data.entries : allEntries;
      fetchThumbnails(newImages, effectiveUrl);
    } catch (err) {
      console.error('[DropboxImport] browse failed:', err);
      setError(err instanceof Error ? err.message : t('failedToBrowseFolder'));
    } finally {
      setLoading(false);
    }
  }

  function handleBrowse() {
    browse(currentPath);
  }

  function navigateToFolder(entry: BrowseEntry) {
    setPathHistory((prev) => [...prev, currentPath]);
    setCurrentPath(entry.path);
    setEntries([]);
    setThumbnails({});
    thumbnailRequestId.current++;
    browse(entry.path);
  }

  function navigateBack() {
    const prev = pathHistory[pathHistory.length - 1] ?? '';
    setPathHistory((h) => h.slice(0, -1));
    setCurrentPath(prev);
    setEntries([]);
    setThumbnails({});
    thumbnailRequestId.current++;
    browse(prev);
  }

  function toggleSelect(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const imagePaths = entries.filter((e) => !e.isFolder).map((e) => e.path);
    const allSelected = imagePaths.every((p) => selected.has(p));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(imagePaths));
    }
  }

  async function handleImport() {
    const paths = entries
      .filter((e) => !e.isFolder && selected.has(e.path))
      .map((e) => e.path);

    if (paths.length === 0) return;

    setState('importing');
    setImportProgress(t('uploadingProgress', { completed: 0, total: paths.length }));
    setError('');

    try {
      const siteId = useSiteStore.getState().siteInfo?.id;
      if (!siteId) throw new Error('No site selected');

      const url = getApiPath(ApiRoute.SITE_DROPBOX_IMPORT, siteId);
      // eslint-disable-next-line no-restricted-globals -- streaming NDJSON response requires raw fetch
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dropboxUrl: dropboxUrl || undefined,
          paths,
          target: {
            anniversaryId: target.anniversaryId,
            occurrenceId: target.occurrenceId,
          },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: { imported: number; failed: number; images: ImageWithDimension[]; errors?: string[] } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.done) {
            finalData = msg;
          } else if (msg.completed != null) {
            setImportProgress(t('uploadingProgress', { completed: msg.completed, total: msg.total }));
          }
        }
      }

      if (!finalData) throw new Error('Stream ended without final result');

      if (finalData.failed > 0) {
        setImportProgress(t('importedWithFailures', { imported: finalData.imported, failed: finalData.failed }));
      }

      setState('done');
      onImported(finalData.images);
      handleClose();
    } catch (err) {
      console.error('[DropboxImport] import failed:', err);
      setError(err instanceof Error ? err.message : t('importFailed'));
      setState('browsing');
    }
  }

  const imageCount = entries.filter((e) => !e.isFolder).length;
  const selectedCount = selected.size;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isClosable={state !== 'importing'} className="max-w-2xl">
      <div className="space-y-4" dir={dir} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h2 className="text-lg font-semibold">{t('dropboxImportTitle')}</h2>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>
        )}

        {/* URL Input State */}
        {state === 'url-input' && (
          <>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {t('dropboxUrlLabel')}
              </label>
              {(() => {
                const dropboxLinks = previousLinks?.filter((l) => l.type === 'dropbox');
                if (!dropboxLinks?.length) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {dropboxLinks.map((link) => (
                      <button
                        key={link.url}
                        type="button"
                        onClick={() => {
                          setDropboxUrl(link.url);
                          browse(currentPath, undefined, link.url);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100"
                        title={link.url}
                      >
                        &#128193; {resolvedLabels[link.url] || getDropboxLabel(link.url) || t('sharedFolder')}
                      </button>
                    ))}
                  </div>
                );
              })()}
              <input
                type="text"
                value={dropboxUrl}
                onChange={(e) => setDropboxUrl(e.target.value)}
                placeholder={t('dropboxUrlLabel')}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {t('dropboxSubfolderLabel')}
              </label>
              <input
                type="text"
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                placeholder={t('dropboxSubfolderPlaceholder')}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>{t('close')}</Button>
              <Button onClick={handleBrowse} disabled={loading}>
                {loading ? t('loading') : t('browse')}
              </Button>
            </div>
            {loading && <Spinner />}
          </>
        )}

        {/* Browsing State */}
        {state === 'browsing' && (
          <>
            {/* Navigation */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {pathHistory.length > 0 && (
                <button
                  onClick={navigateBack}
                  className="text-blue-600 hover:underline flex items-center gap-1"
                  disabled={loading}
                >
                  {t('back')}
                </button>
              )}
              <span className="truncate">{currentPath || '/'}</span>
            </div>

            {/* Loading state */}
            {loading && entries.length === 0 && <Spinner />}

            {/* Select controls */}
            {!loading && imageCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <button onClick={toggleSelectAll} className="text-blue-600 hover:underline">
                  {selectedCount === imageCount ? t('deselectAll') : t('selectAll')}
                </button>
                <span className="text-gray-500">{t('selectedOfTotal', { selected: selectedCount, total: imageCount })}</span>
              </div>
            )}

            {/* Entries grid */}
            {(!loading || entries.length > 0) && (
              <div className="overflow-y-auto flex-1" style={{ maxHeight: '50vh' }}>
                {entries.length === 0 && !loading && (
                  <div className="text-gray-500 text-center py-8">{t('noImagesOrFolders')}</div>
                )}

                {/* Folders first */}
                {entries.filter((e) => e.isFolder).map((entry) => (
                  <button
                    key={entry.path}
                    onClick={() => navigateToFolder(entry)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-start"
                    disabled={loading}
                  >
                    <span className="text-2xl">&#128193;</span>
                    <span className="text-sm truncate">{entry.name}</span>
                  </button>
                ))}

                {/* Image grid */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {entries.filter((e) => !e.isFolder).map((entry) => (
                    <label
                      key={entry.path}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                        selected.has(entry.path) ? 'border-blue-500' : 'border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(entry.path)}
                        onChange={() => toggleSelect(entry.path)}
                        className="absolute top-1 start-1 z-10"
                      />
                      <ThumbnailCell
                        src={thumbnails[entry.dropboxPath || entry.path]}
                        alt={entry.name}
                      />
                    </label>
                  ))}
                </div>

                {/* Load more */}
                {hasMore && (
                  <div className="text-center mt-3">
                    <Button
                      variant="outline"
                      onClick={() => browse(currentPath, cursor)}
                      disabled={loading}
                    >
                      {loading ? t('loading') : t('loadMore')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" onClick={() => { reset(); }}>
                {t('back')}
              </Button>
              <Button onClick={handleImport} disabled={selectedCount === 0 || loading}>
                {t('importSelected', { count: selectedCount })}
              </Button>
            </div>
          </>
        )}

        {/* Importing State */}
        {state === 'importing' && (
          <div className="text-center py-8">
            <Spinner />
            <div className="text-gray-600 mt-3">{importProgress}</div>
            <div className="mt-2 text-sm text-gray-400">{t('importMayTakeMinutes')}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
