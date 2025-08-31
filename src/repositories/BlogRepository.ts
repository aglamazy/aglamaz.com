import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import type { IBlogPost } from '@/entities/BlogPost';

export class BlogRepository {
  private readonly collection = 'blogPosts';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async create(post: Omit<IBlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<IBlogPost> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc();
    const now = Timestamp.now();
    const data = {
      likeCount: 0,
      shareCount: 0,
      ...post,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(data);
    return { id: ref.id, ...data };
  }

  async getById(id: string): Promise<IBlogPost | null> {
    const db = this.getDb();
    const doc = await db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...(doc.data() as Omit<IBlogPost, 'id'>) } as IBlogPost;
  }

  async update(id: string, updates: Partial<Omit<IBlogPost, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).update({ ...updates, updatedAt: Timestamp.now() });
  }

  async markTranslationRequested(id: string, lang: string): Promise<void> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc(id);
    await ref.set({
      translationMeta: {
        requested: { [lang]: Timestamp.now() },
        attempts: FieldValue.increment(1),
      }
    }, { merge: true });
  }

  async addTranslation(id: string, lang: string, data: { title: string; content: string; engine: string }): Promise<void> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc(id);
    await ref.set({
      translations: {
        [lang]: {
          title: data.title,
          content: data.content,
          engine: data.engine,
          translatedAt: Timestamp.now(),
        }
      }
    }, { merge: true });
  }

  async delete(id: string): Promise<void> {
    const db = this.getDb();
    await db.collection(this.collection).doc(id).delete();
  }

  async getAll(): Promise<IBlogPost[]> {
    const db = this.getDb();
    const snap = await db.collection(this.collection).orderBy('createdAt', 'desc').get();
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<IBlogPost, 'id'>) })) as IBlogPost[];
  }

  async getByAuthor(authorId: string): Promise<IBlogPost[]> {
    const db = this.getDb();
    const snap = await db
      .collection(this.collection)
      .where('authorId', '==', authorId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<IBlogPost, 'id'>) })) as IBlogPost[];
  }

  async getPublicBySite(siteId: string, limit = 20): Promise<IBlogPost[]> {
    const db = this.getDb();
    const snap = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('isPublic', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<IBlogPost, 'id'>) })) as IBlogPost[];
  }

  async countPublicSince(siteId: string, since: Timestamp): Promise<number> {
    const db = this.getDb();
    const snap = await db
      .collection(this.collection)
      .where('siteId', '==', siteId)
      .where('isPublic', '==', true)
      .where('createdAt', '>=', since)
      .get();
    return snap.size;
  }
}

export const blogRepository = new BlogRepository();
