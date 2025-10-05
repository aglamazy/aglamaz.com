'use client';

import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Modal from '@/components/ui/Modal';
import LoginPage from '@/components/LoginPage';
import PendingMemberContent from '@/components/PendingMemberContent';
import NotMemberContent from '@/components/NotMemberContent';
import EditUserDetails from '@/components/EditUserDetails';
import styles from './ClientLayoutShell.module.css';
import type { IUser } from '@/entities/User';
import type { IMember } from '@/entities/Member';
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

interface ClientDesktopShellProps extends ModalControls {
  headerReady: boolean;
  presentationModeActive: boolean;
  handleLogout: () => Promise<void>;
  user: IUser | null;
  member: IMember | null;
  siteInfo: ISite | null;
  children: React.ReactNode;
}

export default function ClientDesktopShell({
  headerReady,
  presentationModeActive,
  handleLogout,
  user,
  member,
  siteInfo,
  children,
  isLoginOpen,
  closeLogin,
  isPendingOpen,
  closePending,
  isApplyOpen,
  closeApply,
  isEditOpen,
  closeEdit,
}: ClientDesktopShellProps) {
  const baseClass = styles.desktopContainer;
  const containerClassName = presentationModeActive ? `${baseClass} ${styles.presentationActive}` : baseClass;
  const mainClassName = presentationModeActive ? styles.presentationMain : styles.desktopMain;

  return (
    <div className={containerClassName}>
      {headerReady && !presentationModeActive ? (
        <Header user={user ?? undefined} member={member ?? undefined} onLogout={handleLogout} siteInfo={siteInfo!} />
      ) : null}
      <main className={mainClassName}>{children}</main>
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
