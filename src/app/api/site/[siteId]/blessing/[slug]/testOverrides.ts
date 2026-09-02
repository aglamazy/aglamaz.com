import { BlessingPageRepository } from '@/repositories/BlessingPageRepository';
import { AnniversaryRepository } from '@/repositories/AnniversaryRepository';

// Test-only injection hooks for this route, pulled out of route.ts (webpack's
// route-type validation, unlike Turbopack's, rejects any non-HTTP-method export
// from a route file - see next.config.js's webpack build note, famcircle#170).
let blessingPageRepoOverride: BlessingPageRepository | null = null;
let anniversaryRepoOverride: AnniversaryRepository | null = null;

export function __setMockBlessingPageRepository(repo: BlessingPageRepository | null) {
  blessingPageRepoOverride = repo;
}
export function __setMockAnniversaryRepository(repo: AnniversaryRepository | null) {
  anniversaryRepoOverride = repo;
}
export function getBlessingPageRepoOverride() {
  return blessingPageRepoOverride;
}
export function getAnniversaryRepoOverride() {
  return anniversaryRepoOverride;
}
