'use client';
import { create } from 'zustand';
import { ISite } from "@/entities/Site";

export interface SiteStore {
  siteInfo: ISite | null;
  siteCache: Record<string, ISite>; // Cache by locale
  setSiteInfo: (info: ISite | null) => void;
  hydrateFromWindow: () => void;
  getSiteForLocale: (locale: string) => ISite | null;
  cacheSiteForLocale: (locale: string, site: ISite) => void;
}

const readBootstrapSiteInfo = (): ISite | null => {
  if (typeof window === 'undefined') return null; // SSR guard
  const w = window as any;
  if (w.__SITE_INFO__) return w.__SITE_INFO__ as ISite;

  return null;
};

export const useSiteStore = create<SiteStore>((set, get) => ({
  siteInfo: null,
  siteCache: {},
  setSiteInfo: (info) => set({ siteInfo: info }),
  hydrateFromWindow: () => {
    const info = readBootstrapSiteInfo();
    set((state) => (state.siteInfo === info ? state : { siteInfo: info }));
  },
  getSiteForLocale: (locale: string) => {
    return get().siteCache[locale] ?? null;
  },
  cacheSiteForLocale: (locale: string, site: ISite) => {
    set((state) => ({
      siteInfo: site,
      siteCache: { ...state.siteCache, [locale]: site },
    }));
  },
}));
