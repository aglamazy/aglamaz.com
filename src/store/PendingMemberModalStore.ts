'use client';
import { create } from 'zustand';

interface PendingMemberModalStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const usePendingMemberModalStore = create<PendingMemberModalStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
