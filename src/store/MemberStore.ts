import { create } from 'zustand';
import type { IMember } from '@/entities/Member';

interface MemberState {
  member: IMember | null;
  loading: boolean;
  error: string | null;
  fetchMember: (userId: string, siteId: string) => Promise<void>;
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
      
      const response = await fetch(`/api/user/${userId}/member-info?siteId=${encodeURIComponent(siteId)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch member info');
      }

      const data = await response.json();
      set({ member: data.member, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch member info',
        loading: false 
      });
    }
  },

  setMember: (member) => set({ member }),
  
  clearMember: () => set({ member: null, error: null }),
})); 