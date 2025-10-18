'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function I18nGate({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [, setVersion] = React.useState(0);

  React.useEffect(() => {
    if (i18n.isInitialized) {
      return undefined;
    }

    const handleInitialized = () => {
      setVersion((current) => current + 1);
    };

    i18n.on('initialized', handleInitialized);

    return () => {
      i18n.off('initialized', handleInitialized);
    };
  }, [i18n]);

  return <>{children}</>;
}
