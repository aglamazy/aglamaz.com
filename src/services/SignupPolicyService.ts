import type { ISite } from '@/entities/Site';

/**
 * Demo sites let anyone onboard with zero admin friction: a fresh signup is
 * auto-verified and auto-approved in one step, skipping the email-link and
 * admin-approval steps. Pure + Firestore-free so it's directly unit-testable.
 */
export function shouldAutoApprove(site: Pick<ISite, 'isDemo'> | null | undefined): boolean {
  return site?.isDemo === true;
}
