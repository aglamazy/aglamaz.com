import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import { MemberRepository, type LocalizedMemberRecord } from './MemberRepository';
import type { LikerInfo } from '@/types/likes';

export type MemberCache = Map<string, LocalizedMemberRecord | null>;

function resolveTimestamp(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (typeof input === 'object' && input !== null) {
    const candidate = input as { toDate?: () => Date };
    if (typeof candidate.toDate === 'function') {
      try {
        return candidate.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if ('_seconds' in candidate && typeof (candidate as any)._seconds === 'number') {
      const date = new Date((candidate as any)._seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    if ('seconds' in candidate && typeof (candidate as any).seconds === 'number') {
      const date = new Date((candidate as any).seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
  }
  return null;
}

export interface ImageLikesResult {
  index: number;
  count: number;
  likedByMe: boolean;
  likers: LikerInfo[];
}

export class ImageLikeRepository {
  constructor(private readonly db?: Firestore) {}

  private getDb(): Firestore {
    if (this.db) {
      return this.db;
    }
    initAdmin();
    return getFirestore();
  }

  /**
   * Get likes for a specific image in a gallery photo
   * @param photoId - Gallery photo ID
   * @param imageIndex - Index of the image
   * @param currentUserId - Current user's ID to check if they liked
   * @param siteId - Site ID to fetch member information
   * @param maxLikers - Maximum number of likers to return (undefined = all)
   * @param memberCache - Optional shared cache to avoid duplicate member lookups across calls
   */
  async getLikesForImage(
    photoId: string,
    imageIndex: number,
    currentUserId: string,
    siteId: string,
    maxLikers?: number,
    memberCache?: MemberCache
  ): Promise<ImageLikesResult> {
    const db = this.getDb();
    const likesSnap = await db
      .collection('galleryPhotos')
      .doc(photoId)
      .collection('imageLikes')
      .doc(String(imageIndex))
      .collection('likes')
      .get();

    return this.serializeLikes(likesSnap, currentUserId, siteId, imageIndex, maxLikers, memberCache);
  }

  /**
   * Get likes for a specific image in an anniversary occurrence
   * @param occurrenceId - Occurrence ID
   * @param imageIndex - Index of the image
   * @param currentUserId - Current user's ID to check if they liked
   * @param siteId - Site ID to fetch member information
   * @param maxLikers - Maximum number of likers to return (undefined = all)
   * @param memberCache - Optional shared cache to avoid duplicate member lookups across calls
   */
  async getLikesForOccurrenceImage(
    occurrenceId: string,
    imageIndex: number,
    currentUserId: string,
    siteId: string,
    maxLikers?: number,
    memberCache?: MemberCache
  ): Promise<ImageLikesResult> {
    const db = this.getDb();
    const likesSnap = await db
      .collection('anniversaryOccurrences')
      .doc(occurrenceId)
      .collection('imageLikes')
      .doc(String(imageIndex))
      .collection('likes')
      .get();

    return this.serializeLikes(likesSnap, currentUserId, siteId, imageIndex, maxLikers, memberCache);
  }

  /**
   * Toggle like for a gallery photo image
   */
  async toggleLikeForImage(
    photoId: string,
    imageIndex: number,
    userId: string,
    like: boolean,
    siteId: string,
    maxLikers?: number
  ): Promise<ImageLikesResult> {
    const db = this.getDb();
    const likesRef = db
      .collection('galleryPhotos')
      .doc(photoId)
      .collection('imageLikes')
      .doc(String(imageIndex))
      .collection('likes')
      .doc(userId);

    if (like) {
      await likesRef.set({ createdAt: new Date() }, { merge: true });
    } else {
      await likesRef.delete();
    }

    // Fetch updated likes with liker info
    const countSnap = await likesRef.parent.get();
    return this.serializeLikes(countSnap, userId, siteId, imageIndex, maxLikers);
  }

  /**
   * Toggle like for an anniversary occurrence image
   */
  async toggleLikeForOccurrenceImage(
    occurrenceId: string,
    imageIndex: number,
    userId: string,
    like: boolean,
    siteId: string,
    maxLikers?: number
  ): Promise<ImageLikesResult> {
    const db = this.getDb();
    const likesRef = db
      .collection('anniversaryOccurrences')
      .doc(occurrenceId)
      .collection('imageLikes')
      .doc(String(imageIndex))
      .collection('likes')
      .doc(userId);

    if (like) {
      await likesRef.set({ createdAt: new Date() }, { merge: true });
    } else {
      await likesRef.delete();
    }

    // Fetch updated likes with liker info
    const countSnap = await likesRef.parent.get();
    return this.serializeLikes(countSnap, userId, siteId, imageIndex, maxLikers);
  }

  /**
   * Serialize likes snapshot into structured data with member information
   */
  private async serializeLikes(
    snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>,
    currentUserId: string,
    siteId: string,
    imageIndex: number,
    maxLikers?: number,
    memberCache?: MemberCache
  ): Promise<ImageLikesResult> {
    const memberRepo = new MemberRepository();
    const cache = memberCache ?? new Map();

    // Extract like records and sort by timestamp
    const records = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data() ?? {},
      timestamp: resolveTimestamp((doc.data() as any).createdAt ?? null),
    }));

    records.sort((a, b) => {
      const aMs = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bMs = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bMs - aMs; // Most recent first
    });

    // Limit to first N likers if specified
    const recordsToFetch = maxLikers ? records.slice(0, maxLikers) : records;

    // Batch-fetch uncached members first
    const uncachedUids = recordsToFetch
      .map((r) => r.id)
      .filter((uid) => !cache.has(uid));

    if (uncachedUids.length > 0) {
      await Promise.all(
        uncachedUids.map(async (uid) => {
          try {
            const member = await memberRepo.getByUid(siteId, uid);
            cache.set(uid, member);
          } catch (error) {
            console.error(`[ImageLikeRepository] Error fetching member ${uid}:`, error);
            cache.set(uid, null);
          }
        })
      );
    }

    // Build likers from cache
    const likers: LikerInfo[] = [];
    for (const record of recordsToFetch) {
      const member = cache.get(record.id);
      if (!member) {
        if (!cache.has(record.id)) {
          console.warn(`[ImageLikeRepository] Member not found for userId: ${record.id}`);
        }
        continue;
      }
      likers.push({
        uid: record.id,
        memberId: member.id,
        displayName: member.displayName || member.firstName || member.email || 'Unknown',
        email: member.email || '',
        avatarUrl: member.avatarUrl || null,
        likedAt: record.timestamp,
      });
    }

    return {
      index: imageIndex,
      count: records.length,
      likedByMe: records.some((record) => record.id === currentUserId),
      likers,
    };
  }
}
