import { create } from 'zustand';
import { IUser, User } from '../entities/User';
import { useMemberStore } from './MemberStore';
import { useSiteStore } from './SiteStore';
import { apiFetch } from "@/utils/apiFetch";

interface UserState {
  user: IUser;
  loading: boolean;
  setUser: (user: Partial<IUser> | null) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  setUser: (user: IUser | null) => {
    set({ user });

    // bail if no user_id
    const userId = user?.user_id;
    if (!userId) return;

    // bail if siteInfo not ready yet
    const siteId = useSiteStore.getState().siteInfo?.id;
    if (!siteId) return;

    // ok to fetch
    const memberStore = useMemberStore.getState();
    memberStore.fetchMember(userId, siteId);
  },
  setLoading: (loading) => set({ loading }),
  checkAuth: async () => {
    try {
      const userData = await User.me();
      set({ user: userData, loading: false });
    } catch (error) {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await apiFetch<void>('/api/auth/logout', { method: 'POST', credentials: 'include' });
    set({ user: null });
    const memberStore = useMemberStore.getState();
    memberStore.clearMember();
  },
}));