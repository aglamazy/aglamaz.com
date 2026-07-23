import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '../firebase/admin';
import type { IGrowthLead } from '@/entities/GrowthLead';

/**
 * Prospects/visitors who signed up for FamCircle updates on a public marketing
 * page — NOT existing family-site members. Kept in its own top-level collection,
 * separate from MemberRepository/site data (famcircle#19 killed member-broadcast
 * email; this is a distinct audience with its own list).
 */
export class GrowthLeadRepository {
  private readonly collection = 'growthLeads';

  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async addLead(data: Omit<IGrowthLead, 'id' | 'capturedAt'>): Promise<IGrowthLead> {
    const db = this.getDb();
    const ref = db.collection(this.collection).doc();
    const capturedAt = Timestamp.now();
    await ref.set({ ...data, capturedAt });
    return { id: ref.id, ...data, capturedAt };
  }
}

export const growthLeadRepository = new GrowthLeadRepository();
