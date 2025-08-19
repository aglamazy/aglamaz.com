'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function I18nGate({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const ready = mounted && i18n.isInitialized;
  if (!ready) return null;
  return <>{children}</>;
}