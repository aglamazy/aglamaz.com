import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import crypto from 'crypto';
import type {
  BlogPostLocale,
  BlogPostLocaleUpsertPayload,
  BlogPostLocales,
  IBlogPost,
} from '@/entities/BlogPost';

/** Returns true for any post that should appear in public feeds. Missing status is treated as 'published' for back-compat. */
export function isPublished(post: IBlogPost): boolean {
  return !post.status || post.status === 'published';
}

function cloneMeta(meta: BlogPostLocale['title$meta']) {
  if (!meta) return undefined;
  return { ...meta };
}

type FirestoreDoc = FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot;

export class BlogRepository {
  private readonly collection = 'blogPosts';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  private getBaseQuery() {
    const db = this.getDb();
    return db.collection(this.collection).where('deletedAt', '==', null);
  }

  private createFieldMeta(locale: string, payload: BlogPostLocaleUpsertPayload, timestamp: Timestamp) {
    const engine = payload.engine ?? 'manual';
    const normalizedLocale = locale.toLowerCase();
    const sourceLocaleRaw = payload.sourceLocale ?? (engine === 'manual' ? normalizedLocale : undefined);
    const sourceLocale = sourceLocaleRaw ? sourceLocaleRaw.toLowerCase() : undefined;
    return { updatedAt: timestamp, engine, sourceLocale };
  }

  private makeLocaleSnapshot(
    locale: string,
    payload: BlogPostLocaleUpsertPayload,
    timestamp: Timestamp,
  ): BlogPostLocale {
    const normalized = locale.toLowerCase();
    const meta = this.createFieldMeta(normalized, payload, timestamp);
    const snapshot: BlogPostLocale = {};
    if (payload.title !== undefined) {
      snapshot.title = payload.title;
      snapshot.title$meta = cloneMeta(meta);
    }
    if (payload.content !== undefined) {
      snapshot.content = payload.content;
      snapshot.content$meta = cloneMeta(meta);
    }
    if (payload.seoTitle !== undefined) {
      snapshot.seoTitle = payload.seoTitle;
      snapshot.seoTitle$meta = cloneMeta(meta);
    }
    if (payload.seoDescription !== undefined) {
      snapshot.seoDescription = payload.seoDescription;
      snapshot.seoDescription$meta = cloneMeta(meta);
    }
    return snapshot;
  }

  private makeLocaleUpdate(
    locale: string,
    payload: BlogPostLocaleUpsertPayload,
    timestamp: Timestamp,
  ): Record<string, unknown> {
    const normalized = locale.toLowerCase();
    const update: Record<string, unknown> = {};
    const meta = this.createFieldMeta(normalized, payload, timestamp);
    const prefix = `locales.${normalized}`;
    if (payload.title !== undefined) {
      update[`${prefix}.title`] = payload.title;
      update[`${prefix}.title$meta`] = cloneMeta(meta);
    }
    if (payload.content !== undefined) {
      update[`${prefix}.content`] = payload.content;
      update[`${prefix}.content$meta`] = cloneMeta(meta);
    }
    if (payload.seoTitle !== undefined) {
      update[`${prefix}.seoTitle`] = payload.seoTitle;
      update[`${prefix}.seoTitle$meta`] = cloneMeta(meta);
    }
    if (payload.seoDescription !== undefined) {
      update[`${prefix}.seoDescription`] = payload.seoDescription;
      update[`${prefix}.seoDescription$meta`] = cloneMeta(meta);
    }
    return update;
  }

  private legacyLocales(data: FirebaseFirestore.DocumentData | undefined): BlogPostLocales {
    if (!data) return {};
    const locales: BlogPostLocales = {};
    const source = ((data as any).sourceLang || (data as any).primaryLocale || 'en').toLowerCase();
    if (data.title || data.content) {
      locales[source] = {
        title: data.title,
        content: data.content,
      };
    }
    if (data.translations && typeof data.translations === 'object') {
      for (const [key, value] of Object.entries<any>(data.translations)) {
        const normalizedKey = key.toLowerCase();
        locales[normalizedKey] = {
          title: value?.title,
          content: value?.content,
        };
      }
    }
    return locales;
  }

  private mapDoc(doc: FirestoreDoc): IBlogPost {
    const raw = doc.data();
    if (!raw) {
      throw new Error(`Blog post ${doc.id} is missing data`);
    }
    const locales = (raw.locales as BlogPostLocales | undefined) || this.legacyLocales(raw);
    const primaryLocale = (raw.primaryLocale || raw.sourceLang || Object.keys(locales)[0] || 'en').toLowerCase();
    return {
      id: doc.id,
      authorId: raw.authorId,
      siteId: raw.siteId,
      primaryLocale,
      locales,
      translationMeta: raw.translationMeta,
      isPublic: Boolean(raw.isPublic),
      status: raw.status,
      reviewToken: raw.reviewToken,
      reviewTokenExpiresAt: raw.reviewTokenExpiresAt,
      reviewFeedback: raw.reviewFeedback,
      reviewDecision: raw.reviewDecision,
      reviewDecidedAt: raw.reviewDecidedAt,
      likeCount: raw.likeCount ?? 0,
      shareCount: raw.shareCount ?? 0,
      taggedMemberIds: raw.taggedMemberIds ?? [],
      deletedAt: raw.deletedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  async create(post: {
    authorId: string;
    siteId: string;
    primaryLocale: string;
    isPublic: boolean;
    localeContent: BlogPostLocaleUpsertPayload;
    translationMeta?: IBlogPost['translationMeta'];
    taggedMemberIds?: string[];
  }): Promise<IBlogPost> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc();
    const now = Timestamp.now();
    const localeKey = post.primaryLocale.toLowerCase();
    const localeSnapshot = this.makeLocaleSnapshot(localeKey, post.localeContent, now);
    const data: {
      authorId: string;
      siteId: string;
      primaryLocale: string;
      locales: Record<string, BlogPostLocale>;
      translationMeta?: IBlogPost['translationMeta'];
      isPublic: boolean;
      likeCount: number;
      shareCount: number;
      taggedMemberIds: string[];
      deletedAt: Timestamp | null;
      createdAt: Timestamp;
      updatedAt: Timestamp;
    } = {
      authorId: post.authorId,
      siteId: post.siteId,
      primaryLocale: localeKey,
      locales: { [localeKey]: localeSnapshot },
      isPublic: post.isPublic,
      likeCount: 0,
      shareCount: 0,
      taggedMemberIds: post.taggedMemberIds || [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    if (post.translationMeta !== undefined) {
      data.translationMeta = post.translationMeta;
    }
    await ref.set(data);
    return { id: ref.id, ...data };
  }

  async getById(id: string): Promise<IBlogPost | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return this.mapDoc(doc);
  }

  async update(
    id: string,
    updates: Partial<Omit<IBlogPost, 'id' | 'createdAt' | 'updatedAt' | 'locales'>>,
  ): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).update({ ...updates, updatedAt: Timestamp.now() });
  }

  async upsertLocale(id: string, locale: string, payload: BlogPostLocaleUpsertPayload): Promise<void> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc(id);
    const timestamp = Timestamp.now();
    const localeUpdate = this.makeLocaleUpdate(locale, payload, timestamp);
    if (Object.keys(localeUpdate).length === 0) return;
    await ref.set({ ...localeUpdate, updatedAt: timestamp }, { merge: true });
  }

  async markTranslationRequested(id: string, lang: string): Promise<void> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc(id);
    await ref.set(
      {
        [`translationMeta.requested.${lang}`]: Timestamp.now(),
        'translationMeta.attempts': FieldValue.increment(1),
      },
      { merge: true },
    );
  }

  async addTranslation(
    id: string,
    lang: string,
    data: { title: string; content: string; engine?: string; sourceLocale?: string },
  ): Promise<void> {
    await this.upsertLocale(id, lang, {
      title: data.title,
      content: data.content,
      engine: (data.engine as BlogPostLocaleUpsertPayload['engine']) ?? 'gpt',
      sourceLocale: data.sourceLocale,
    });
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }

  async softDelete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).update({
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  async getAll(): Promise<IBlogPost[]> {
    const snap = await this.getBaseQuery().orderBy('createdAt', 'desc').get();
    return snap.docs.map((doc) => this.mapDoc(doc));
  }

  async getByAuthor(authorId: string): Promise<IBlogPost[]> {
    const snap = await this.getBaseQuery()
      .where('authorId', '==', authorId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((doc) => this.mapDoc(doc)).filter(isPublished);
  }

  async getBySite(siteId: string): Promise<IBlogPost[]> {
    const snap = await this.getBaseQuery()
      .where('siteId', '==', siteId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map((doc) => this.mapDoc(doc)).filter(isPublished);
  }

  async getPublicBySite(siteId: string, limit = 20): Promise<IBlogPost[]> {
    const snap = await this.getBaseQuery()
      .where('siteId', '==', siteId)
      .where('isPublic', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((doc) => this.mapDoc(doc)).filter(isPublished);
  }

  async countPublicSince(siteId: string, since: Timestamp): Promise<number> {
    const snap = await this.getBaseQuery()
      .where('siteId', '==', siteId)
      .where('isPublic', '==', true)
      .where('createdAt', '>=', since)
      .get();
    return snap.size;
  }

  async countPublicBySite(siteId: string): Promise<number> {
    const snap = await this.getBaseQuery()
      .where('siteId', '==', siteId)
      .where('isPublic', '==', true)
      .get();
    return snap.size;
  }

  private async incrementCounter(id: string, field: 'shareCount' | 'likeCount'): Promise<number> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc(id);
    await ref.update({ [field]: FieldValue.increment(1) });
    const snap = await ref.get();
    const data = snap.data();
    if (!data) {
      throw new Error(`Blog post ${id} not found while incrementing ${field}`);
    }
    return data[field] ?? 0;
  }

  async incrementShare(id: string): Promise<number> {
    return this.incrementCounter(id, 'shareCount');
  }

  async incrementLike(id: string): Promise<number> {
    return this.incrementCounter(id, 'likeCount');
  }

  /** Sets status='in_review', generates a 24h review token, and returns it. */
  async requestReview(postId: string): Promise<string> {
    const db = this.getDb();
    const token = crypto.randomUUID();
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);
    await db.collection(this.collection).doc(postId).update({
      status: 'in_review',
      reviewToken: token,
      reviewTokenExpiresAt: expiresAt,
      updatedAt: now,
    });
    return token;
  }

  /** Returns the post for the given review token, or null if missing or expired. */
  async getByReviewToken(token: string): Promise<IBlogPost | null> {
    const db = this.getDb();
    const now = Timestamp.now();
    const snap = await db
      .collection(this.collection)
      .where('reviewToken', '==', token)
      .where('deletedAt', '==', null)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const post = this.mapDoc(snap.docs[0]);
    if (!post.reviewTokenExpiresAt) return null;
    const expiresMillis = post.reviewTokenExpiresAt.toMillis
      ? post.reviewTokenExpiresAt.toMillis()
      : Date.parse(String(post.reviewTokenExpiresAt));
    if (expiresMillis < now.toMillis()) return null;
    return post;
  }

  /**
   * Records the reviewer's decision:
   * - 'approved' → sets status='published' (isPublic is NOT touched per spec)
   * - 'changes_requested' → stores feedback/decision/decidedAt; status stays 'in_review'
   * Returns the updated post, or null if the token is missing/expired.
   */
  async decideReview(
    token: string,
    decision: 'approved' | 'changes_requested',
    feedback?: string,
  ): Promise<IBlogPost | null> {
    const post = await this.getByReviewToken(token);
    if (!post) return null;
    const db = this.getDb();
    const now = Timestamp.now();
    const updates: Record<string, unknown> = {
      reviewDecision: decision,
      reviewDecidedAt: now,
      updatedAt: now,
    };
    if (decision === 'approved') {
      updates.status = 'published';
    } else {
      updates.reviewFeedback = feedback ?? '';
    }
    await db.collection(this.collection).doc(post.id).update(updates);
    return this.getById(post.id);
  }
}

export const blogRepository = new BlogRepository();
