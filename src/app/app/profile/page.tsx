'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import EditUserDetails from '@/components/EditUserDetails';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useEffect } from 'react';
import { useEditUserModalStore } from '@/store/EditUserModalStore';
import styles from './profile.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { open, close } = useEditUserModalStore();

  // Open the modal store when this page mounts (for EditUserDetails to work)
  useEffect(() => {
    open();
    return () => {
      close();
    };
  }, [open, close]);

  // On desktop, redirect to home and let the modal handle it
  useEffect(() => {
    if (!isMobile) {
      router.push('/app');
      // The desktop layout will show the modal
    }
  }, [isMobile, router]);

  if (!isMobile) {
    return null; // Redirecting to /app
  }

  return (
    <div className={styles.container}>
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
