// TEMP famcircle#179: storage for /api/debug/auth-report. Remove with the route.
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/admin';
import type { DebugAuthReportInput, DebugAuthReportServerFacts } from '@/utils/debugAuthReport';

export interface IDebugAuthReport extends DebugAuthReportInput, DebugAuthReportServerFacts {
  id: string;
  createdAt: string;
}

const COLLECTION = 'debug_auth_reports';

export class DebugAuthReportRepository {
  private getDb() {
    initAdmin();
    return getFirestore();
  }

  async record(report: DebugAuthReportInput, facts: DebugAuthReportServerFacts): Promise<string> {
    const ref = await this.getDb().collection(COLLECTION).add({
      ...report,
      ...facts,
      createdAt: Timestamp.now(),
    });
    return ref.id;
  }

  async listRecent(limit: number): Promise<IDebugAuthReport[]> {
    const snapshot = await this.getDb().collection(COLLECTION).orderBy('createdAt', 'desc').limit(limit).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return { ...data, id: doc.id, createdAt: (data.createdAt as Timestamp).toDate().toISOString() } as IDebugAuthReport;
    });
  }
}
