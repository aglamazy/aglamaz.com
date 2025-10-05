'use client';

import React from 'react';
import SweepableElement from './SweepableElement';

export function DummySlides() {
  return (
    <>
      <SweepableElement label="Red" background="linear-gradient(135deg, #ef4444, #f97316)">
        Red Section
      </SweepableElement>
      <SweepableElement label="Green" background="linear-gradient(135deg, #22c55e, #16a34a)">
        Green Section
      </SweepableElement>
      <SweepableElement label="Blue" background="linear-gradient(135deg, #3b82f6, #1d4ed8)">
        Blue Section
      </SweepableElement>
    </>
  );
}
