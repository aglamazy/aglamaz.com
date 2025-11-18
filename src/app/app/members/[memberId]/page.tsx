"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import MemberAvatar from '@/components/MemberAvatar';
import { apiFetch } from '@/utils/apiFetch';
import { ApiRoute } from '@/entities/Routes';
import styles from './member-profile.module.css';
import { formatLocalizedDate } from '@/utils/dateFormat';

interface MemberSummary {
  id: string;
  displayName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  createdAt?: any;
}

export default function MemberProfilePage() {
  const params = useParams<{ memberId: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [member, setMember] = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const data = await apiFetch<{ member: MemberSummary }>(ApiRoute.SITE_MEMBER_BY_ID, {
          pathParams: { memberId: params.memberId },
        });
        if (!active) return;
        setMember(data.member);
      } catch (err) {
        console.error('[member-profile] failed to load member', err);
        if (active) setError(t('somethingWentWrong') as string);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.memberId, t]);

  if (loading) {
    return <div className={styles.container}>{t('loading')}</div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.error}>{error}</p>
        <button type="button" className={styles.backBtn} onClick={() => router.back()}>
          {t('back') || 'Back'}
        </button>
      </div>
    );
  }

  if (!member) {
    return (
      <div className={styles.container}>
        <p className={styles.error}>{t('noMemberFound') || 'Member not found'}</p>
        <button type="button" className={styles.backBtn} onClick={() => router.back()}>
          {t('back') || 'Back'}
        </button>
      </div>
    );
  }

  const joined = member.createdAt ? formatLocalizedDate(member.createdAt, i18n.language) : null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={() => router.back()}>
          ←
        </button>
        <h1>{member.displayName}</h1>
      </header>
      <div className={styles.card}>
        <MemberAvatar
          member={{
            id: member.id,
            displayName: member.displayName,
            email: member.email,
            avatarUrl: member.avatarUrl || undefined,
          } as any}
          size={72}
        />
        <div className={styles.details}>
          <div>
            <span className={styles.label}>{t('email') as string}</span>
            <span className={styles.value}>{member.email || '—'}</span>
          </div>
          <div>
            <span className={styles.label}>{t('role') as string}</span>
            <span className={styles.value}>{member.role}</span>
          </div>
          {joined ? (
            <div>
              <span className={styles.label}>{t('joined') || 'Joined'}</span>
              <span className={styles.value}>{joined}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
