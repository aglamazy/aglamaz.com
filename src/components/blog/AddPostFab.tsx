"use client";

import { useEffect, useState } from 'react';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until client-side mounted
  if (!mounted) return null;

  if (!user || !member?.blogEnabled) return null;

  return (
    <AddFab ariaLabel={t('add') as string} onClick={() => router.push('/app/blog/new')} />
  );
}
