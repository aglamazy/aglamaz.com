"use client";

import Link from 'next/link';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import { useTranslation } from 'react-i18next';

interface AuthorPostActionsProps {
  postId: string;
  authorId: string;
}

export default function AuthorPostActions({ postId, authorId }: AuthorPostActionsProps) {
  const user = useUserStore((state) => state.user);
  const member = useMemberStore((state) => state.member);
  const { t } = useTranslation();

  const isOwner = user?.user_id === authorId;
  const isAdmin = member?.role === 'admin';

  if (!isOwner && !isAdmin) return null;

  return (
    <Link
      href={`/blog/${postId}/edit`}
      className="text-sm text-blue-600 hover:underline"
    >
      {t('edit') as string}
    </Link>
  );
}
