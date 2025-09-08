"use client";

import React from 'react';

interface AddFabProps {
  onClick: () => void;
  ariaLabel?: string;
}

export default function AddFab({ onClick, ariaLabel = 'Add' }: AddFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 bg-primary text-white w-12 h-12 rounded-full shadow-lg hover:bg-secondary flex items-center justify-center text-2xl"
    >
      +
    </button>
  );
}
