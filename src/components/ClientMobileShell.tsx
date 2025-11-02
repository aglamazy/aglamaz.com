'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import LoginPage from '@/components/LoginPage';
import PendingMemberContent from '@/components/PendingMemberContent';
import NotMemberContent from '@/components/NotMemberContent';
import EditUserDetails from '@/components/EditUserDetails';
import BottomTabBar from '@/components/mobile/BottomTabBar';
import styles from './ClientLayoutShell.module.css';
import type { TFunction } from 'i18next';

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
  children: React.ReactNode;
}

export default function ClientMobileShell({
  t,
  presentationModeActive,
  children,
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

  return (
    <div className={containerClassName}>
      <main className={styles.mobileMain}>
        {children}
      </main>
      <BottomTabBar />
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
