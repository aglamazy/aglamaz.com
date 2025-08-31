"use client";

import AddFab from '@/components/ui/AddFab';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useTranslation } from 'react-i18next';

export default function AddPostFab() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const member = useMemberStore((s) => s.member);

  if (!user || !member?.blogEnabled) return null;

  return (
    <AddFab ariaLabel={t('add') as string} onClick={() => router.push('/blog/new')} />
  );
}

