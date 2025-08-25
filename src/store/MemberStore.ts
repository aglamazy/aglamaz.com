import { create } from 'zustand';
import type { IMember } from '@/entities/Member';
import { apiFetch } from '@/utils/apiFetch';

interface MemberState {
  member: IMember | null;
  loading: boolean;
  error: string | null;
  fetchMember: (userId: string, siteId: string) => Promise<'member' | 'pending' | 'not_applied' | 'error'>;
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

      const data = await apiFetch<{ status: string; member?: IMember }>(`/api/user/member-info?siteId=${siteId}`);
      if (data.member) {
        set({ member: data.member, loading: false });
      } else {
        set({ member: null, loading: false });
      }
      if (data.status === 'member') return 'member';
      if (data.status === 'pending') return 'pending';
      return 'not_applied';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch member info';
      set({ error: message, loading: false });
      return 'error';
    }
  },

  setMember: (member) => set({ member }),
  
  clearMember: () => set({ member: null, error: null }),
})); 