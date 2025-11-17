'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import EditUserDetails from '@/components/EditUserDetails';
import styles from './profile.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/app';

  return (
    // Mobile-only page - hidden on desktop via CSS
    <div className={`${styles.container} mobile-only`}>
      <div className={styles.header}>
        <button
          onClick={() => router.back()}
          className={styles.backButton}
          aria-label="Go back"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.title}>Profile</h1>
      </div>
      <div className={styles.content}>
        <EditUserDetails standalone={true} returnTo={returnTo} />
      </div>
    </div>
  );
}
