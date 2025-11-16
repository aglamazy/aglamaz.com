import { useEffect } from 'react';

// Global ref to store the current add action
let currentAddAction: (() => void) | null = null;

export function useAddAction(action: () => void) {
  useEffect(() => {
    currentAddAction = action;
    return () => {
      currentAddAction = null;
    };
  }, [action]);
}

export function triggerAddAction() {
  if (currentAddAction) {
    currentAddAction();
    return true;
  }
  return false;
}
