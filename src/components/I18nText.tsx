"use client";

import { useTranslation } from 'react-i18next';

interface Props {
  k: string;
  options?: Record<string, any>;
  className?: string;
}

export default function I18nText({ k, options, className }: Props) {
  const { t } = useTranslation();
  return <span className={className}>{t(k, options as any) as string}</span>;
}

