'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Image, Plus, FileText, User } from 'lucide-react';
import { useUserStore } from '@/store/UserStore';
import { useMemberStore } from '@/store/MemberStore';
import MemberAvatar from '@/components/MemberAvatar';
import { useState } from 'react';
import styles from './BottomTabBar.module.css';
import PhotoUploadModal from '@/components/photos/PhotoUploadModal';

interface TabItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  isAdd?: boolean;
}

export default function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const member = useMemberStore((state) => state.member);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // Determine what the Add button should do based on current page
  const handleAddClick = () => {
    if (pathname?.startsWith('/app/blog')) {
      // Navigate to new blog post page
      router.push('/app/blog/new');
    } else if (pathname?.startsWith('/app/calendar')) {
      // TODO: Open add anniversary modal or navigate to add page
      console.log('Add anniversary/event');
    } else if (pathname === '/app' || pathname?.startsWith('/app/')) {
      // Main app page (pictures feed) - upload photo
      setPhotoModalOpen(true);
    } else {
      // Default: show a menu or do nothing
      console.log('Add action');
    }
  };

  const tabs: TabItem[] = [
    {
      id: 'profile',
      icon: (
        <MemberAvatar
          member={member}
          fallbackName={user?.name}
          fallbackEmail={member?.email || user?.email}
          size={28}
        />
      ),
      label: 'Profile',
      path: '/app/profile',
    },
    {
      id: 'gallery',
      icon: <Image size={24} />,
      label: 'Gallery',
      path: '/app',
    },
    {
      id: 'add',
      icon: <Plus size={28} />,
      label: 'Add',
      path: '', // Special handling
      isAdd: true,
    },
    {
      id: 'blog',
      icon: <FileText size={24} />,
      label: 'Blog',
      path: '/app/blog',
    },
    {
      id: 'calendar',
      icon: <Calendar size={24} />,
      label: 'Calendar',
      path: '/app/calendar',
    },
  ];

  const isActive = (path: string) => {
    if (!pathname || !path) return false;
    return pathname.startsWith(path);
  };

  return (
    <>
      <nav className={styles.container} role="navigation" aria-label="Main navigation">
        <div className={styles.tabBar}>
          {tabs.map((tab) => {
            const active = isActive(tab.path);

            if (tab.isAdd) {
              return (
                <button
                  key={tab.id}
                  onClick={handleAddClick}
                  className={`${styles.tab} ${styles.addTab}`}
                  aria-label={tab.label}
                >
                  <div className={styles.addIconWrapper}>
                    {tab.icon}
                  </div>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.path)}
                className={`${styles.tab} ${active ? styles.active : ''}`}
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                <div className={styles.iconWrapper}>
                  {tab.icon}
                </div>
                <span className={styles.label}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <PhotoUploadModal
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        onSuccess={() => {
          setPhotoModalOpen(false);
          // TODO: Refresh feed when backend is ready
        }}
      />
    </>
  );
}
