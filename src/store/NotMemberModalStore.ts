'use client';
import { create } from 'zustand';

interface NotMemberModalStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useNotMemberModalStore = create<NotMemberModalStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
