const map = new Map<string, string>();

export const memoryRefreshStore = {
  put: (userId: string, hashed: string) => { map.set(userId, hashed); },
  get: (userId: string) => map.get(userId) ?? null,
  del: (userId: string) => { map.delete(userId); },
};
