'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X, User, LogOut, Home, Users, Heart, Settings, MessageCircle, Calendar } from 'lucide-react';
import { useMemberStore } from '@/store/MemberStore';
import { useTranslation } from 'react-i18next';

interface NavigationProps {
  user: any;
  onLogout: () => void;
  setMobileMenuOpen?: (open: boolean) => void;
}

export default function Navigation({ user, onLogout, setMobileMenuOpen }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpenState] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const member = useMemberStore((state) => state.member);
  const { t } = useTranslation();

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  // When mobile menu state changes, notify parent
  useEffect(() => {
    if (setMobileMenuOpen) setMobileMenuOpen(isMobileMenuOpen);
  }, [isMobileMenuOpen, setMobileMenuOpen]);

  const navigationItems = [
    { name: t('home'), href: '/app', icon: Home },
    { name: t('family'), href: '/family', icon: Users },
    { name: t('familyCalendar', { defaultValue: 'Family Calendar' }) as string, href: '/calendar', icon: Calendar },
  ];

  // Add admin link if user is admin
  const adminItems = [
    { name: t('pendingMembers'), href: '/admin/pending-members', icon: Users },
    { name: t('siteMembers'), href: '/admin/site-members', icon: Users },
    { name: t('contactMessages'), href: '/admin/contact-messages', icon: MessageCircle },
  ];

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    onLogout();
  };

  const getUserInitials = (user: any) => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="bg-white shadow-sm  sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className="text-sage-600 hover:text-sage-700 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    <Icon size={16} />
                    {item.name}
                  </button>
                );
              })}
              
              {/* Admin links */}
              {user?.isAdmin && adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className="text-red-600 hover:text-red-700 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    <Icon size={16} />
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6 relative">
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-3 text-sage-600 hover:text-sage-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage-500 rounded-full transition-colors duration-200"
                >
                </button>

                {isUserMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="py-1">
                      {/* Admin menu items if member is admin */}
                      {member?.role === 'admin' && adminItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.name}
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              router.push(item.href);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors duration-200"
                          >
                            <Icon size={16} className="mr-3" />
                            {item.name}
                          </button>
                        );
                      })}
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-sage-700 hover:bg-sage-50 transition-colors duration-200"
                      >
                        <LogOut size={16} className="mr-3" />
                        {t('logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpenState(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-sage-600 hover:text-sage-700 hover:bg-sage-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sage-500"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X size={24} />
              ) : (
                <Menu size={24} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden animate-in slide-in-from-top-2 duration-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-sage-200 shadow-lg">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    router.push(item.href);
                    setIsMobileMenuOpenState(false);
                  }}
                  className="text-sage-600 hover:text-sage-700 hover:bg-sage-50 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 flex items-center gap-3 w-full text-left"
                >
                  <Icon size={20} />
                  {item.name}
                </button>
              );
            })}
            
            {/* Admin links */}
            { adminItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    router.push(item.href);
                    setIsMobileMenuOpenState(false);
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 flex items-center gap-3 w-full text-left"
                >
                  <Icon size={20} />
                  {item.name}
                </button>
              );
            })}
            
            {/* Mobile User Info and Logout */}
            <div className="border-t border-sage-200 pt-4 mt-4">
              <div className="flex items-center px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-sage-600 flex items-center justify-center text-white text-sm font-medium mr-3">
                  {getUserInitials(user)}
                </div>
                <span className="text-sm font-medium text-sage-700">{user?.name || 'User'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-sage-600 hover:text-sage-700 hover:bg-sage-50 block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 flex items-center gap-3 w-full text-left"
              >
                <LogOut size={20} />
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
} 
