import { create } from 'zustand';
import type { IMember } from '@/entities/Member';
import { apiFetch } from '@/utils/apiFetch';

export enum MembershipStatus {
  Member = 'member',
  Pending = 'pending',
  NotApplied = 'not_applied',
  Error = 'error',
}

interface MemberState {
  member: IMember | null;
  loading: boolean;
  error: string | null;
  fetchMember: (userId: string, siteId: string) => Promise<MembershipStatus>;
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
      if (data.status === 'member') return MembershipStatus.Member;
      if (data.status === 'pending') return MembershipStatus.Pending;
      return MembershipStatus.NotApplied;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch member info';
      set({ error: message, loading: false });
      return MembershipStatus.Error;
    }
  },

  setMember: (member) => set({ member }),
  
  clearMember: () => set({ member: null, error: null }),
})); 