import { create } from 'zustand';
import { IUser, User } from '../entities/User';
import { useMemberStore } from './MemberStore';
import { useSiteStore } from './SiteStore';
import { apiFetch } from "@/utils/apiFetch";
import { ApiRoute } from '@/utils/urls';

const readBootstrapUser = (): IUser | null => {
  if (typeof document === 'undefined') return null; // SSR guard
  // See SiteStore.ts readBootstrapSiteInfo() - read textContent, don't rely on script execution.
  const el = document.getElementById('__USER__');
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as IUser;
  } catch {
    return null;
  }
};

interface UserState {
  user: IUser;
  loading: boolean;
  setUser: (user: Partial<IUser> | null) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  hydrateFromWindow: () => void;
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
  hydrateFromWindow: () => {
    const hydrated = readBootstrapUser();
    if (hydrated) {
      set({ user: hydrated, loading: false });
    }
  },
  checkAuth: async () => {
    // Try hydration first
    const current = get().user;
    if (current) {
      // Already hydrated
      return;
    }

    // Try bootstrap hydration if not already loaded
    const hydrated = readBootstrapUser();
    if (hydrated) {
      set({ user: hydrated, loading: false });
      return;
    }

    // Fall back to API call
    try {
      const userData = await User.me();
      set({ user: userData, loading: false });
    } catch (error) {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await apiFetch<void>(ApiRoute.AUTH_LOGOUT, { method: 'POST' });
    set({ user: null });
    const memberStore = useMemberStore.getState();
    memberStore.clearMember();
  },
}));