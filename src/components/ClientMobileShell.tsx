'use client';

import React, { useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import LoginPage from '@/components/LoginPage';
import PendingMemberContent from '@/components/PendingMemberContent';
import NotMemberContent from '@/components/NotMemberContent';
import EditUserDetails from '@/components/EditUserDetails';
import SweepableContainer from '@/components/mobile/SweepableContainer';
import SweepableElement from '@/components/mobile/SweepableElement';
import PicturesFeedPage from '@/app/(app)/pictures/feed/page';
import CalendarPage from '@/app/(app)/calendar/page';
import BlogPage from '@/app/(app)/blog/page';
import ShimmerImagePreview from '@/components/mobile/ShimmerImagePreview';
import Footer from '@/components/Footer';
import styles from './ClientLayoutShell.module.css';
import type { TFunction } from 'i18next';
import type { ISite } from '@/entities/Site';

interface ModalControls {
  isLoginOpen: boolean;
  closeLogin: () => void;
  isPendingOpen: boolean;
  closePending: () => void;
  isApplyOpen: boolean;
  closeApply: () => void;
  isEditOpen: boolean;
  closeEdit: () => void;
}

interface ClientMobileShellProps extends ModalControls {
  t: TFunction;
  presentationModeActive: boolean;
  siteInfo: ISite | null;
}

export default function ClientMobileShell({
  t,
  presentationModeActive,
  siteInfo,
  isLoginOpen,
  closeLogin,
  isPendingOpen,
  closePending,
  isApplyOpen,
  closeApply,
  isEditOpen,
  closeEdit,
}: ClientMobileShellProps) {
  const baseClass = styles.mobileContainer;
  const containerClassName = presentationModeActive ? `${baseClass} ${styles.presentationActive}` : baseClass;

  const indicatorLabel = useMemo(
    () => (t('mobileSections', { defaultValue: 'Mobile sections' }) as string) || 'Mobile sections',
    [t]
  );

  const shimmerLabel = t('loadingPreview', { defaultValue: 'Loading Preview' }) as string;
  const calendarLabel = t('calendar') as string;
  const photoFeedLabel = t('photoFeed', { defaultValue: 'Photo Feed' }) as string;
  const blogLabel = t('blog') as string;

  return (
    <div className={containerClassName}>
      <main className={styles.mobileMain}>
        <SweepableContainer indicatorLabel={indicatorLabel}>
          <SweepableElement label={calendarLabel}>
            <CalendarPage />
          </SweepableElement>
          <SweepableElement label={photoFeedLabel}>
            <PicturesFeedPage />
          </SweepableElement>
          <SweepableElement label={blogLabel}>
            <BlogPage />
          </SweepableElement>
        </SweepableContainer>
      </main>
      {siteInfo && !presentationModeActive ? <Footer siteInfo={siteInfo} /> : null}
      <Modal isOpen={isLoginOpen} onClose={closeLogin}>
        <LoginPage/>
      </Modal>
      <Modal isOpen={isPendingOpen} onClose={closePending} isClosable={false}>
        <PendingMemberContent/>
      </Modal>
      <Modal isOpen={isApplyOpen} onClose={closeApply}>
        <NotMemberContent/>
      </Modal>
      <Modal isOpen={isEditOpen} onClose={closeEdit}>
        <EditUserDetails/>
      </Modal>
    </div>
  );
}
