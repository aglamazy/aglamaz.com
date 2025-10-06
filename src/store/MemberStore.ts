import { create } from 'zustand';
import md5 from 'blueimp-md5';
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
  resolveAvatar: (options?: ResolveAvatarOptions) => MemberAvatar;
}

export type MemberAvatar =
  | { type: 'uploaded'; url: string }
  | { type: 'gravatar'; url: string }
  | { type: 'initials'; initials: string };

export interface ResolveAvatarOptions {
  fallbackEmail?: string;
  fallbackName?: string;
  size?: number;
  includeUploaded?: boolean;
}

const computeInitials = (name?: string, email?: string): string => {
  const base = name?.trim() || email?.split('@')[0] || '';
  if (!base) return '?';
  const parts = base
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '?';
  const letters = parts.map((part) => part[0]?.toUpperCase() || '').join('');
  return letters || '?';
};

export const computeMemberAvatar = (
  member: IMember | null | undefined,
  { fallbackEmail = '', fallbackName = '', size = 64, includeUploaded = true }: ResolveAvatarOptions = {}
): MemberAvatar => {
  if (includeUploaded && member?.avatarUrl) {
    return { type: 'uploaded', url: member.avatarUrl };
  }
  const email = member?.email || fallbackEmail;
  if (email) {
    const hash = md5(email.trim().toLowerCase());
    const url = `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
    return { type: 'gravatar', url };
  }
  const initials = computeInitials(member?.displayName || fallbackName, email);
  return { type: 'initials', initials };
};

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
  resolveAvatar: (options) => computeMemberAvatar(get().member, options),
}));
