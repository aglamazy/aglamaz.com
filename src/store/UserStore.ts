import { create } from 'zustand';
import { IUser, User } from '../entities/User';
import { useMemberStore } from './MemberStore';
import { useSiteStore } from './SiteStore';
import { apiFetch } from "@/utils/apiFetch";
import { router } from "next/client";
const pathname = typeof window !== "undefined" ? window.location.pathname : "";
const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth");

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
  loading: !isAuthRoute,
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
      const me = async () => {
        const res = await apiFetch('/api/auth/me', { method: 'GET', credentials: 'include' });
        if (!res.ok) return null;
        return (await res.json()) as IUser;
      };
      let userData = await me();
      if (!userData) {
        const r = await apiFetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
        if (r.ok) userData = await me();
      }
      set({ user: userData ?? null, loading: false });
      if (userData?.user_id) {
        const siteId = useSiteStore.getState().siteInfo.id;
        const memberStore = useMemberStore.getState();
        await memberStore.fetchMember(userData.user_id, siteId);
      }
    } catch (error) {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await apiFetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    set({ user: null });
    const memberStore = useMemberStore.getState();
    memberStore.clearMember();
    router.replace('/login');
  },
}));