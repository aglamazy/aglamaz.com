'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
import styles from './ClientLayoutShell.module.css';
import type { TFunction } from 'i18next';

const ROUTE_ORDER = ['/calendar', '/pictures/feed', '/blog'] as const;
const PATH_TO_INDEX: Record<string, number> = {
  '/calendar': 0,
  '/pictures/feed': 1,
  '/app': 1,
  '/blog': 2,
};

const normalizePathname = (path: string) => {
  if (!path) return '/';
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

const getIndexFromPath = (path: string) => {
  const normalized = normalizePathname(path);
  return PATH_TO_INDEX[normalized] ?? 1;
};

const getPathFromIndex = (index: number) => ROUTE_ORDER[index] ?? ROUTE_ORDER[1];

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
}

export default function ClientMobileShell({
  t,
  presentationModeActive,
  isLoginOpen,
  closeLogin,
  isPendingOpen,
  closePending,
  isApplyOpen,
  closeApply,
  isEditOpen,
  closeEdit,
}: ClientMobileShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const baseClass = styles.mobileContainer;
  const containerClassName = presentationModeActive ? `${baseClass} ${styles.presentationActive}` : baseClass;

  const indicatorLabel = useMemo(
    () => (t('mobileSections', { defaultValue: 'Mobile sections' }) as string) || 'Mobile sections',
    [t]
  );

  const [activeIndex, setActiveIndex] = useState(() => getIndexFromPath(pathname));

  useEffect(() => {
    const nextIndex = getIndexFromPath(pathname);
    setActiveIndex((prev) => (prev === nextIndex ? prev : nextIndex));
  }, [pathname]);

  const shimmerLabel = t('loadingPreview', { defaultValue: 'Loading Preview' }) as string;
  const calendarLabel = t('calendar') as string;
  const photoFeedLabel = t('photoFeed', { defaultValue: 'Photo Feed' }) as string;
  const blogLabel = t('blog') as string;

  const handleActiveIndexChange = React.useCallback(
    (nextIndex: number) => {
      const clampedIndex = Math.max(0, Math.min(nextIndex, ROUTE_ORDER.length - 1));
      setActiveIndex((prev) => (prev === clampedIndex ? prev : clampedIndex));

      const targetPath = getPathFromIndex(clampedIndex);
      const normalizedCurrent = normalizePathname(pathname);
      const normalizedTarget = normalizePathname(targetPath);

      if (normalizedCurrent === normalizedTarget) {
        return;
      }

      router.replace(targetPath);
    },
    [pathname, router]
  );

  return (
    <div className={containerClassName}>
      <main className={styles.mobileMain}>
        <SweepableContainer
          indicatorLabel={indicatorLabel}
          activeIndex={activeIndex}
          onActiveIndexChange={handleActiveIndexChange}
        >
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
