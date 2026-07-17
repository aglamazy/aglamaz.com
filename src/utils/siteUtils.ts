import type { ISite } from '@/entities/Site';

export function shouldAutoApprove(site: ISite | null | undefined): boolean {
  return !!site?.isDemo;
}
