import { create } from 'zustand';
import type { IMember } from '@/entities/Member';
import { apiFetch } from '@/utils/apiFetch';

interface MemberState {
  member: IMember | null;
  loading: boolean;
  error: string | null;
  fetchMember: (userId: string, siteId: string) => Promise<boolean>;
  setMember: (member: IMember | null) => void;
  clearMember: () => void;
}

export const useMemberStore = create<MemberState>((set, get) => ({
  member: null,
  loading: false,
  error: null,
  
  fetchMember: async (userId: string, siteId: string) => {
    try {
      set({ loading: true, error: null });

      const data = await apiFetch<{ member: IMember }>(`/api/user/${userId}/member-info?siteId=${siteId}`);
      set({ member: data.member, loading: false });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch member info';
      if (message.startsWith('HTTP 404')) {
        set({ member: null, loading: false, error: null });
      } else {
        set({ error: message, loading: false });
      }
    }
    return false;
  },

  setMember: (member) => set({ member }),
  
  clearMember: () => set({ member: null, error: null }),
})); 