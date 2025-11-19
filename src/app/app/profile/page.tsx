'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, LogOut } from 'lucide-react';
import EditUserDetails from '@/components/EditUserDetails';
import styles from './profile.module.css';
import { useUserStore } from '@/store/UserStore';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/app';
  const { logout } = useUserStore();
  const { t, i18n } = useTranslation();
  const [logoutError, setLogoutError] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async (): Promise<boolean> => {
    setLogoutError('');
    setLogoutLoading(true);
    try {
      await logout();
      await router.replace('/auth/login');
      return true;
    } catch (err) {
      console.error('[profile] logout failed', err);
      setLogoutError(t('somethingWentWrong'));
      return false;
    } finally {
      setLogoutLoading(false);
    }
  };

  const focusProfile = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current.focus({ preventScroll: true });
    }
  };

  const BackIcon = i18n.dir() === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    // Mobile-only page - hidden on desktop via CSS
    <div className={`${styles.container} mobile-only`}>
      <div className={styles.header} dir={i18n.dir()}>
        <button
          type="button"
          onClick={() => router.back()}
          className={styles.backButton}
          aria-label={t('back') || 'Back'}
        >
          <BackIcon size={24} />
        </button>
        <h1 className={styles.headerTitle}>{t('editProfile')}</h1>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </div>
      <div className={styles.content} ref={formRef} tabIndex={-1}>
        <EditUserDetails standalone={true} returnTo={returnTo} />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.logoutButton}
            onClick={() => { void handleLogout(); }}
            disabled={logoutLoading}
          >
            <LogOut size={18} />
            {logoutLoading ? t('loading') : t('logout')}
          </button>
          {logoutError && <div className={styles.errorText}>{logoutError}</div>}
        </div>
      </div>
    </div>
  );
}
