import { initAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { HealthCheckResult } from '@/types/health';

export class FirebaseService {
  static async getHealth(): Promise<HealthCheckResult> {
    // Check required environment variables
    const requiredVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      return {
        healthy: false,
        status: `Missing environment variables: ${missingVars.join(', ')}`,
      };
    }

    // Try to initialize Firebase and perform a simple Firestore operation
    try {
      initAdmin();
      const db = getFirestore();

      // Perform a lightweight read operation to test connectivity
      // We'll try to get a non-existent document to avoid side effects
      const testDocRef = db.collection('_health_check').doc('test');
      await testDocRef.get();

      return {
        healthy: true,
        status: 'OK',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        healthy: false,
        status: `Failed to connect to Firestore: ${errorMessage}`,
      };
    }
  }
}
