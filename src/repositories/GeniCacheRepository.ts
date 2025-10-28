import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';

interface GetOptions {
  ttlMs?: number;
}

export interface GeniCacheHit<T> {
  key: string;
  data: T;
  createdAt: Date | null;
  updatedAt: Date | null;
  stale: boolean;
}

type RawCacheDocument<T> = {
  payload?: T;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  key?: string;
} & Record<string, unknown>;

export class GeniCacheRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private getCollection() {
    return this.getDb().collection('geni_cache');
  }

  private docRef(key: string) {
    return this.getCollection().doc(key);
  }

  async get<T>(key: string, options?: GetOptions): Promise<GeniCacheHit<T> | null> {
    const snap = await this.docRef(key).get();
    if (!snap.exists) {
      return null;
    }

    const raw = (snap.data() || {}) as RawCacheDocument<T>;
    const createdAt = this.toDate(raw.createdAt);
    const updatedAt = this.toDate(raw.updatedAt);
    const payload =
      raw.payload !== undefined
        ? raw.payload
        : (this.stripMetadata(raw) as T);

    const ttlMs = options?.ttlMs;
    const stale =
      ttlMs !== undefined
        ? !updatedAt || Date.now() - updatedAt.getTime() > ttlMs
        : false;

    return {
      key,
      data: payload,
      createdAt,
      updatedAt,
      stale,
    };
  }

  async upsert<T>(key: string, data: T): Promise<void> {
    const db = this.getDb();
    const docRef = this.docRef(key);
    const now = Timestamp.now();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      let createdAt = now;
      if (snap.exists) {
        const raw = snap.data() as RawCacheDocument<T> | undefined;
        const existingCreatedAt = raw?.createdAt;
        if (existingCreatedAt instanceof Timestamp) {
          createdAt = existingCreatedAt;
        } else if (existingCreatedAt instanceof Date) {
          createdAt = Timestamp.fromDate(existingCreatedAt);
        }
      }

      tx.set(docRef, {
        key,
        payload: data,
        createdAt,
        updatedAt: now,
      });
    });
  }

  private toDate(value: Timestamp | Date | undefined): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Timestamp) {
      return value.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    return null;
  }

  private stripMetadata<T>(raw: RawCacheDocument<T>): T {
    const clone: Record<string, unknown> = { ...raw };
    delete clone.payload;
    delete clone.createdAt;
    delete clone.updatedAt;
    delete clone.key;
    return clone as T;
  }
}
