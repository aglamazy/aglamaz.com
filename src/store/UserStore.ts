import { create } from 'zustand';
import { User } from '../entities/User';
import { useMemberStore } from './MemberStore';
import { useSiteStore } from './SiteStore';
import { signOut } from 'firebase/auth';
import { initFirebase, auth } from '../firebase/client';

interface UserState {
  user: any;
  loading: boolean;
  setUser: (user: any) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: true,
  setUser: (user) => {
    set({ user });
    if (user && user.user_id) {
      const siteId = useSiteStore.getState().siteInfo.id;
  
        const memberStore = useMemberStore.getState();
        memberStore.fetchMember(user.user_id, siteId);
      
    }
  },
  setLoading: (loading) => set({ loading }),
  checkAuth: async () => {
    try {
      const userData = await User.me();
      set({ user: userData, loading: false });
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
    initFirebase();
    try {
      await signOut(auth());
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    set({ user: null });
    const memberStore = useMemberStore.getState();
    memberStore.clearMember();
  },
}));