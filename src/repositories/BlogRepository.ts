import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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
    const data = { ...post, createdAt: now, updatedAt: now };
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
}

export const blogRepository = new BlogRepository();
