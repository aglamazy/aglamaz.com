import { create } from 'zustand';
import { ISite } from "@/entities/Site";


interface SiteStore {
  siteInfo: ISite | null;
  setSiteInfo: (info: ISite) => void;
}

export const useSiteStore = create<SiteStore>((set) => ({
  siteInfo: null,
  setSiteInfo: (info: ISite) => set({ siteInfo: info }),
})); 