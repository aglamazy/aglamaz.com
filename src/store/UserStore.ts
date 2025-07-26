import { create } from 'zustand';
import { User } from '../entities/User';

interface UserState {
  user: any;
  loading: boolean;
  setUser: (user: any) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
  logout: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  checkAuth: async () => {
    try {
      const userData = await User.me();
      set({ user: userData, loading: false });
    } catch (error) {
      set({ user: null, loading: false });
    }
  },
  logout: () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    set({ user: null });
  },
})); 