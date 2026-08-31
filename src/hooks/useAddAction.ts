'use client';

import { createContext, useContext, useEffect } from 'react';

// ClientLayoutShell mounts every page TWICE at once - once inside .mobile-only,
// once inside .desktop-only (globals.css switches which is display:none via a
// 768px media query, but BOTH stay mounted as independent React instances with
// independent state). Without ShellKindContext, both instances' useAddAction
// calls raced to overwrite the single currentAddAction global, and the hidden
// desktop instance could win - the mobile "+" would then open a modal that only
// exists in the CSS-hidden tree (famcircle, 2026-08-31: blessing-page mobile FAB
// opened an invisible modal, root-caused via Chrome DevTools DOM inspection).
export type ShellKind = 'mobile' | 'desktop';
const ShellKindContext = createContext<ShellKind | null>(null);
export const ShellKindProvider = ShellKindContext.Provider;

// Matches the breakpoint in src/app/globals.css's .mobile-only/.desktop-only rules.
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

let currentAddAction: (() => void) | null = null;
let currentAddActionOwner: ShellKind | null = null;

export function useAddAction(action: () => void) {
  const shellKind = useContext(ShellKindContext);

  useEffect(() => {
    if (typeof window === 'undefined' || !shellKind) return undefined;

    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const applyIfVisible = () => {
      const visibleShell: ShellKind = mql.matches ? 'mobile' : 'desktop';
      if (shellKind !== visibleShell) return;
      currentAddAction = action;
      currentAddActionOwner = shellKind;
    };

    applyIfVisible();
    mql.addEventListener('change', applyIfVisible);

    return () => {
      mql.removeEventListener('change', applyIfVisible);
      // Only the instance that actually registered clears it - the hidden
      // instance's unmount/cleanup must never null out the visible one's action.
      if (currentAddActionOwner === shellKind) {
        currentAddAction = null;
        currentAddActionOwner = null;
      }
    };
  }, [action, shellKind]);
}

export function triggerAddAction() {
  if (currentAddAction) {
    currentAddAction();
    return true;
  }
  return false;
}
