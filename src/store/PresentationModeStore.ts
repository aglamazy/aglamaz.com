'use client';

import { create } from 'zustand';

interface PresentationModeState {
  active: boolean;
  enable: () => void;
  disable: () => void;
}

export const usePresentationModeStore = create<PresentationModeState>((set) => ({
  active: false,
  enable: () => set({ active: true }),
  disable: () => set({ active: false }),
}));
