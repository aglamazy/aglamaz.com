'use client';
import { create } from 'zustand';
import { ISite } from "@/entities/Site";

export interface SiteStore {
  siteInfo: ISite | null;
  setSiteInfo: (info: ISite) => void;
}

const readBootstrapSiteInfo = (): ISite | null => {
  if (typeof window === 'undefined') return null; // SSR guard
  const w = window as any;
  if (w.__SITE_INFO__) return w.__SITE_INFO__ as ISite;

  return null;
};

type State = {
  siteInfo: ISite | null;
  setSiteInfo: (info: ISite | null) => void;
};

export const useSiteStore = create<State>((set) => ({
  siteInfo: readBootstrapSiteInfo(),   // ✅ set once, synchronously
  setSiteInfo: (info) => set({ siteInfo: info }),
}));