'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import EditUserDetails from '@/components/EditUserDetails';
import { useEffect } from 'react';
import { useEditUserModalStore } from '@/store/EditUserModalStore';
import styles from './profile.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const { open, close } = useEditUserModalStore();

  // Open the modal store when this page mounts (for EditUserDetails to work)
  useEffect(() => {
    open();
    return () => {
      close();
    };
  }, [open, close]);

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
        <EditUserDetails />
      </div>
    </div>
  );
}
