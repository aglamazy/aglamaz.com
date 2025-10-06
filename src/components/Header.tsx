"use client";

import React, { useState, useRef, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useTranslation } from 'react-i18next';
import { LogOut, Users, MessageCircle, Home as HomeIcon, BookOpen, User } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { IUser } from "@/entities/User";
import { IMember } from "@/entities/Member";
import { ISite } from "@/entities/Site";
import { useLoginModalStore } from '@/store/LoginModalStore';
import { useEditUserModalStore } from '@/store/EditUserModalStore';
import { getLocalizedSiteName } from '@/utils/siteName';
import MemberAvatar from '@/components/MemberAvatar';

const LANGS = [
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

interface HeaderProps {
  user?: IUser;
  member?: IMember;
  onLogout?: () => void;
  siteInfo: ISite;
}

export default function Header({ user, member, onLogout, siteInfo }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { i18n, t } = useTranslation();
  const userMenuRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openLogin = useLoginModalStore((s) => s.open);
  const openEdit = useEditUserModalStore((s) => s.open);
  const localizedName = getLocalizedSiteName(siteInfo, i18n.language);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
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

  const handleLangChange = (lang: string) => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    // Reflect selection in URL so server components (public pages) render the chosen language
    try {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('lang', lang);
      const newUrl = `${pathname}?${params.toString()}`;
      router.replace(newUrl, { scroll: false });
      router.refresh();
    } catch {}
    setIsLangMenuOpen(false);
  };

  const menuPosition = i18n.language === 'he' ? 'left-0' : 'right-0';
  return (
    <header className="w-full flex items-center justify-between px-4 py-2 bg-white shadow-sm sticky top-0 z-50">
      {/* Left: Site title */}
      <div className="text-xl font-semibold text-sage-700">
        {localizedName || siteInfo.name}
      </div>
      {/* Center: Navigation */}
      <div className="flex flex-row items-center">
        {user && member && onLogout && member.role !== 'pending' ? (
          <Navigation user={user} onLogout={onLogout} setMobileMenuOpen={setMobileMenuOpen}/>
        ) : (
          <nav className="hidden md:flex items-center gap-6 text-sage-700">
            {(() => { const isRTL = (i18n.language || '').startsWith('he'); return (
              <>
                <a className="hover:underline flex items-center gap-1" href="/">
                  {isRTL ? (<><span>{t('home') as string}</span><HomeIcon size={18} /></>) : (<><HomeIcon size={18} /><span>{t('home') as string}</span></>)}
                </a>
                <a className="hover:underline flex items-center gap-1" href="/blog/family">
                  {isRTL ? (<><span>{t('blog') as string}</span><BookOpen size={18} /></>) : (<><BookOpen size={18} /><span>{t('blog') as string}</span></>)}
                </a>
                <a className="hover:underline flex items-center gap-1" href="/contact">
                  {isRTL ? (<><span>{t('contactUs') as string}</span><MessageCircle size={18} /></>) : (<><MessageCircle size={18} /><span>{t('contactUs') as string}</span></>)}
                </a>
              </>
            ); })()}
          </nav>
        )}
      </div>
      {/* Right: Flags + Avatar */}
      <div className="flex items-center gap-2 relative">
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setIsLangMenuOpen((v) => !v)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-xl bg-gray-100 hover:bg-gray-200 border border-gray-300"
            aria-label={t('changeLanguage') as string}
          >
            {LANGS.find(l => l.code === i18n.language)?.flag || '🌐'}
          </button>
          {isLangMenuOpen && (
            <div className={`language-menu ${menuPosition}`}>
              <div className="py-1 flex flex-col">
                {LANGS.map(({ code, label, flag }) => (
                  <button
                    key={code}
                    onClick={() => handleLangChange(code)}
                    className={`language-menu-item ${i18n.language === code ? 'font-bold' : ''}`}
                  >
                    <span>{flag}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Avatar + User Menu */}
        {user && member && onLogout ? (
        <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen((v) => !v)}
              className="h-8 w-8 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage-500 transition-colors duration-200"
              aria-label={t('userMenu') as string}
            >
              <MemberAvatar member={member} fallbackName={user?.name} fallbackEmail={member?.email || user?.email} size={32} />
            </button>
            {isUserMenuOpen && (
              <div
                className={`origin-top-right absolute ${menuPosition} mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50`}>
                <div className="py-1">
                  {/* Admin menu items if member is admin */}
                  {member?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push('/admin/pending-members');
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors duration-200"
                      >
                        <Users size={16} className="mr-3"/>
                        {t('pendingMembers')}
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push('/admin/site-members');
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors duration-200"
                      >
                        <Users size={16} className="mr-3"/>
                        {t('siteMembers')}
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          router.push('/admin/contact-messages');
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition-colors duration-200"
                      >
                        <MessageCircle size={16} className="mr-3"/>
                        {t('contactMessages')}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      openEdit();
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-sage-700 hover:bg-sage-50 transition-colors duration-200"
                  >
                    <User size={16} className="mr-3"/>
                    {t('editProfile')}
                  </button>
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout?.();
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-sage-700 hover:bg-sage-50 transition-colors duration-200"
                  >
                    <LogOut size={16} className="mr-3"/>
                    {t('logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={openLogin}
            className="h-8 px-3 rounded-full bg-sage-600 text-white text-sm"
          >
            {t('signIn')}
          </button>
        )}
      </div>
    </header>
  );
}
