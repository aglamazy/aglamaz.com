import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { BlessingRepository } from '@/repositories/BlessingRepository';
import type { NotificationEventType } from '@/services/AdminNotificationService';

// Test-only injection hooks for this route, pulled out of route.ts (webpack's
// route-type validation, unlike Turbopack's, rejects any non-HTTP-method export
// from a route file - see next.config.js's webpack build note, famcircle#170).
type NotifyFn = (eventType: NotificationEventType, payload: any, siteUrl?: string) => Promise<any>;

let blessingPageRepoOverride: BlessingPageRepository | null = null;
let blessingRepoOverride: BlessingRepository | null = null;
let notifyOverride: NotifyFn | null = null;

export function __setMockBlessingPageRepository(repo: BlessingPageRepository | null) {
  blessingPageRepoOverride = repo;
}
export function __setMockBlessingRepository(repo: BlessingRepository | null) {
  blessingRepoOverride = repo;
}
export function __setMockNotify(fn: NotifyFn | null) {
  notifyOverride = fn;
}
export function getBlessingPageRepoOverride() {
  return blessingPageRepoOverride;
}
export function getBlessingRepoOverride() {
  return blessingRepoOverride;
}
export function getNotifyOverride() {
  return notifyOverride;
}
