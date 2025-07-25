import { create } from 'zustand';

interface SiteInfo {
  [key: string]: any;
}

interface SiteStore {
  siteInfo: SiteInfo | null;
  setSiteInfo: (info: SiteInfo) => void;
}

export const useSiteStore = create<SiteStore>((set) => ({
  siteInfo: null,
  setSiteInfo: (info) => set({ siteInfo: info }),
})); 