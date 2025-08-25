'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SignupForm from '@/components/SignupForm';
import { useNotMemberModalStore } from '@/store/NotMemberModalStore';

export default function NotMemberContent() {
  const { i18n } = useTranslation();
  const { close } = useNotMemberModalStore();

  return (
    <div className="flex justify-center" dir={i18n.dir()} lang={i18n.language}>
      <SignupForm onSuccess={close} onCancel={close} />
    </div>
  );
}
