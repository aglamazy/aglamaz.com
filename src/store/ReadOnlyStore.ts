'use client';
import { create } from 'zustand';

export interface ReadOnlyStore {
  isReadOnly: boolean;
  hydrateFromWindow: () => void;
}

const readBootstrapReadOnly = (): boolean => {
  if (typeof document === 'undefined') return false; // SSR guard
  // See SiteStore.ts readBootstrapSiteInfo() - read textContent, don't rely on script execution.
  const el = document.getElementById('__READONLY__');
  if (!el?.textContent) return false;
  try {
    return JSON.parse(el.textContent) === true;
  } catch {
    return false;
  }
};

export const useReadOnlyStore = create<ReadOnlyStore>((set, get) => ({
  // Default false to match SSR (no `document` server-side) - hydrated for real via
  // hydrateFromWindow() in a useEffect post-mount (see MemberStore/UserStore's same
  // pattern), NOT eagerly at store creation like SiteStore - an eager read here would
  // run during the client's hydration pass itself and mismatch the SSR HTML, since
  // `document` already exists on the client at module-eval time.
  isReadOnly: false,
  hydrateFromWindow: () => {
    const isReadOnly = readBootstrapReadOnly();
    set((state) => (state.isReadOnly === isReadOnly ? state : { isReadOnly }));
  },
}));
