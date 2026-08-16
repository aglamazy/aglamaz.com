import { after } from 'next/server';
import { reportFault } from 'agents-observe';

/**
 * Keep scheduler-auth failures visible without delaying or changing the 401.
 * `after()` is required here: a bare promise can be abandoned when a Vercel
 * function returns the response.
 */
export function reportCronAuthFailure(route: string): void {
  after(() =>
    reportFault({
      status: 401,
      error_class: 'cron_auth_mismatch',
      message: `${route} rejected a scheduler request with an invalid CRON_SECRET bearer token`,
    }).catch(() => {
      // Observability must never turn an expected auth rejection into a 500.
    }),
  );
}
