'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Calendar, Image, Plus, FileText, User } from 'lucide-react';
import { useUserStore } from '@/store/UserStore';
import { useMemo } from 'react';
import styles from './BottomTabBar.module.css';

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

  // Get user initials for avatar fallback
  const userInitials = useMemo(() => {
    if (!user?.name) return 'U';
    const names = user.name.trim().split(' ');
    if (names.length === 1) return names[0][0].toUpperCase();
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }, [user?.name]);

  // Determine what the Add button should do based on current page
  const handleAddClick = () => {
    if (pathname?.startsWith('/app/blog')) {
      // Navigate to new blog post page
      router.push('/app/blog/new');
    } else if (pathname?.startsWith('/app/calendar')) {
      // TODO: Open add anniversary modal or navigate to add page
      // For now, we can trigger an event or use a store
      console.log('Add anniversary/event');
    } else if (pathname?.startsWith('/app/pictures')) {
      // TODO: Open photo upload
      console.log('Upload photo');
    } else {
      // Default: show a menu or do nothing
      console.log('Add action');
    }
  };

  const tabs: TabItem[] = [
    {
      id: 'profile',
      icon: user?.picture ? (
        <img
          src={user.picture}
          alt=""
          className={styles.avatarImage}
        />
      ) : (
        <div className={styles.avatarFallback}>{userInitials}</div>
      ),
      label: 'Profile',
      path: '/app/profile',
    },
    {
      id: 'gallery',
      icon: <Image size={24} />,
      label: 'Gallery',
      path: '/app/pictures/feed',
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
  );
}
