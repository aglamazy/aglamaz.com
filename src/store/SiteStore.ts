'use client';
import { create } from 'zustand';
import { ISite } from "@/entities/Site";

export interface SiteStore {
  siteInfo: ISite | null;
  setSiteInfo: (info: ISite | null) => void;
  hydrateFromWindow: () => void;
}

const readBootstrapSiteInfo = (): ISite | null => {
  if (typeof window === 'undefined') return null; // SSR guard
  const w = window as any;
  if (w.__SITE_INFO__) return w.__SITE_INFO__ as ISite;

  return null;
};

export const useSiteStore = create<SiteStore>((set) => ({
  siteInfo: null,
  setSiteInfo: (info) => set({ siteInfo: info }),
  hydrateFromWindow: () => {
    const info = readBootstrapSiteInfo();
    set((state) => (state.siteInfo === info ? state : { siteInfo: info }));
  },
}));
