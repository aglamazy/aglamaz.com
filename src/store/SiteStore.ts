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
  if (typeof document === 'undefined') return null; // SSR guard
  // Read the raw JSON out of the bootstrap <script> tag's textContent rather than
  // relying on it having executed as JS: dangerouslySetInnerHTML-injected <script>
  // tags never run their code on a client-side (soft) navigation, only on a real
  // document parse - but their textContent is always present in the DOM either way.
  const el = document.getElementById('__SITE_INFO__');
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as ISite;
  } catch {
    return null;
  }
};

export const useSiteStore = create<SiteStore>((set, get) => ({
  siteInfo: readBootstrapSiteInfo(), // Hydrate immediately on store creation
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
