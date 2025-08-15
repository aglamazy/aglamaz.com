import { create } from 'zustand';
import { IUser, User } from '../entities/User';
import { useMemberStore } from './MemberStore';
import { useSiteStore } from './SiteStore';
import { signOut } from 'firebase/auth';
import { initFirebase, auth } from '../firebase/client';

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
  loading: true,
  setUser: (user: IUser | null) => {
    set({user});

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
  setLoading: (loading) => set({loading}),
  checkAuth: async () => {
    try {
      const userData = await User.me();
      set({user: userData, loading: false});
      if (userData?.user_id) {
        const siteId = useSiteStore.getState().siteInfo.id;
        const memberStore = useMemberStore.getState();
        await memberStore.fetchMember(userData.user_id, siteId);

      }
    } catch (error) {
      set({user: null, loading: false});
    }
  },
  logout: async () => {
    initFirebase();
    try {
      await signOut(auth());
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    set({ user: null });
    const memberStore = useMemberStore.getState();
    memberStore.clearMember();
  },
}));