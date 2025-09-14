'use client';
import { create } from 'zustand';

interface EditUserModalStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useEditUserModalStore = create<EditUserModalStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
