// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { GmailService } from '@/services/GmailService';
import { TranslationService } from '@/services/TranslationService';
import { FirebaseService } from '@/services/FirebaseService';
import { getVersion } from '@/utils/version';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Run health checks for all services in parallel
    const [firebase, gmail, translation] = await Promise.all([
      FirebaseService.getHealth(),
      GmailService.getHealth(),
      TranslationService.getHealth(),
    ]);

    // Determine overall health status
    // Critical services: firebase (database), gmail (for user notifications)
    // Optional services: translation (nice to have but not critical)
    const criticalServicesHealthy = firebase.healthy && gmail.healthy;
    const allServicesHealthy = firebase.healthy && gmail.healthy && translation.healthy;

    const response = {
      version: getVersion(),
      firebase: {
        healthy: firebase.healthy,
        status: firebase.status,
      },
      gmail: {
        healthy: gmail.healthy,
        status: gmail.status,
      },
      translation: {
        healthy: translation.healthy,
        status: translation.status,
      },
      overall: {
        healthy: criticalServicesHealthy,
        allHealthy: allServicesHealthy,
      },
    };

    // Return 200 if critical services are healthy, 503 otherwise
    const statusCode = criticalServicesHealthy ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Health check failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
