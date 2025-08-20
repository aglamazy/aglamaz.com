export interface RefreshStore {
  put(userId: string, hashedToken: string): Promise<void> | void;
  get(userId: string): Promise<string | null> | string | null;
  del(userId: string): Promise<void> | void;
}

export { memoryRefreshStore as refreshStore } from './memory';

export const refreshRateLimit = new Map<string, number>();
