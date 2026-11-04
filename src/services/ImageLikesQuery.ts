import type { ImageLikeRepository, ImageLikesResult, MemberCache } from '@/repositories/ImageLikeRepository';
import { parseIndexArray, parseIndexList } from '@/utils/imageIndexes';

/**
 * Like reads for named image indexes (famcircle#199, Agla chose option a on 2026-11-03:
 * ask for likes only for the photos on screen).
 *
 * Each index is its own Firestore collection get (imageLikes/{idx}/likes), so this reads
 * EXACTLY the indexes it is given - never 0..imageCount. The result is keyed BY IMAGE
 * INDEX: once the indexes are sparse (60..119 of a 1041-photo occurrence), a positional
 * array would hang photo 60's likes on photo 0.
 */

export type LikesReader = Pick<ImageLikeRepository, 'getLikesForImage' | 'getLikesForOccurrenceImage'>;
export type LikesTargetType = 'gallery' | 'occurrence';
/** Image index -> its likes. JSON turns the keys into strings; JS lookup by number still works. */
export type LikesByIndex = Record<number, ImageLikesResult>;

/** First likers returned per image, for the avatar stack. */
const AVATAR_LIKERS = 3;

export async function fetchLikesByIndex(
  reader: LikesReader,
  type: LikesTargetType,
  id: string,
  indexes: number[],
  userId: string,
  siteId: string,
  memberCache: MemberCache,
): Promise<LikesByIndex> {
  const results = await Promise.all(
    indexes.map((idx) =>
      type === 'gallery'
        ? reader.getLikesForImage(id, idx, userId, siteId, AVATAR_LIKERS, memberCache)
        : reader.getLikesForOccurrenceImage(id, idx, userId, siteId, AVATAR_LIKERS, memberCache),
    ),
  );
  const byIndex: LikesByIndex = {};
  indexes.forEach((idx, i) => {
    byIndex[idx] = results[i];
  });
  return byIndex;
}

export interface PictureLikesResponse {
  /** Indexed requests: item id -> image index -> likes. */
  byIndex: Record<string, LikesByIndex>;
  /**
   * Legacy `imageCount` requests only (a client bundle cached from before famcircle#199),
   * in the old positional-array shape that bundle reads. Remove after one release.
   */
  likes: Record<string, ImageLikesResult[]>;
}

export type PictureLikesOutcome = { ok: true; body: PictureLikesResponse } | { ok: false; error: string };

/**
 * POST /pictures/likes body: { items: [{ id, type, indexes: number[] }] }.
 * `imageCount` is still accepted for one release; when `indexes` is present it wins.
 */
export async function fetchPictureLikes(
  reader: LikesReader,
  rawItems: unknown,
  userId: string,
  siteId: string,
): Promise<PictureLikesOutcome> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'items array is required' };
  }

  type Planned = { id: string; type: LikesTargetType; indexes: number[]; legacy: boolean };
  const planned: Planned[] = [];

  for (const raw of rawItems) {
    const item = raw as { id?: unknown; type?: unknown; indexes?: unknown; imageCount?: unknown };
    if (typeof item?.id !== 'string' || !item.id) continue;
    if (item.type !== 'gallery' && item.type !== 'occurrence') continue;
    if (item.indexes !== undefined) {
      const parsed = parseIndexArray(item.indexes);
      if ('error' in parsed) return { ok: false, error: `${item.id}: ${parsed.error}` };
      planned.push({ id: item.id, type: item.type, indexes: parsed.indexes, legacy: false });
    } else if (typeof item.imageCount === 'number') {
      const count = Math.max(0, Math.floor(item.imageCount));
      planned.push({ id: item.id, type: item.type, indexes: Array.from({ length: count }, (_, i) => i), legacy: true });
    }
  }

  const body: PictureLikesResponse = { byIndex: {}, likes: {} };
  const memberCache: MemberCache = new Map();

  await Promise.all(
    planned.map(async (p) => {
      try {
        const byIndex = await fetchLikesByIndex(reader, p.type, p.id, p.indexes, userId, siteId, memberCache);
        if (p.legacy) {
          body.likes[p.id] = p.indexes.map((idx) => byIndex[idx]);
        } else {
          body.byIndex[p.id] = byIndex;
        }
      } catch (err) {
        console.error(`[pictures/likes] fetch failed for ${p.id}:`, err);
      }
    }),
  );

  return { ok: true, body };
}

export type OccurrenceLikesResponse =
  /** `?indexes=` given: image index -> likes, for exactly those indexes. */
  | { byIndex: LikesByIndex }
  /** No `?indexes=`: every image, positional, as before famcircle#199 (an un-updated caller). */
  | { items: ImageLikesResult[] };

export type OccurrenceLikesOutcome = { ok: true; body: OccurrenceLikesResponse } | { ok: false; error: string };

/**
 * GET /anniversaries/{a}/events/{occId}/image-likes[?indexes=60,61,...].
 * `imageTotal` is the occurrence's image count; an index at or past it is a bad request.
 */
export async function fetchOccurrenceLikes(
  reader: LikesReader,
  occurrenceId: string,
  imageTotal: number,
  rawIndexes: string | null,
  userId: string,
  siteId: string,
): Promise<OccurrenceLikesOutcome> {
  const memberCache: MemberCache = new Map();

  if (rawIndexes === null) {
    const all = Array.from({ length: imageTotal }, (_, i) => i);
    const byIndex = await fetchLikesByIndex(reader, 'occurrence', occurrenceId, all, userId, siteId, memberCache);
    return { ok: true, body: { items: all.map((i) => byIndex[i]) } };
  }

  const parsed = parseIndexList(rawIndexes);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const outOfRange = parsed.indexes.find((i) => i >= imageTotal);
  if (outOfRange !== undefined) {
    return { ok: false, error: `image index ${outOfRange} out of range (occurrence has ${imageTotal})` };
  }
  const byIndex = await fetchLikesByIndex(reader, 'occurrence', occurrenceId, parsed.indexes, userId, siteId, memberCache);
  return { ok: true, body: { byIndex } };
}
