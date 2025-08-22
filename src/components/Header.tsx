import React, { useState, useRef, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useTranslation } from 'react-i18next';
import { LogOut, Users, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IUser } from "@/entities/User";
import { IMember } from "@/entities/Member";
import { ISite } from "@/entities/Site";
import { useLoginModalStore } from '@/store/LoginModalStore';

const LANGS = [
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

function getUserInitials(member: IMember) {
  if (!member?.displayName) return 'U';
  return member.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Header({ user, member, onLogout, siteInfo }: {
  user: IUser,
  member: IMember,
  onLogout: any,
  siteInfo: ISite
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { i18n, t } = useTranslation();
  const userMenuRef = useRef(null);
  const router = useRouter();
  const openLogin = useLoginModalStore((s) => s.open);

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

  const handleLangChange = (lang) => {
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
    setIsLangMenuOpen(false);
  };

  const menuPosition = i18n.language === 'he' ? 'left-0' : 'right-0';
  return (
    <header className="w-full flex items-center justify-between px-4 py-2 bg-white shadow-sm sticky top-0 z-50">
      {/* Left: Site title */}
      <div className="text-xl font-semibold text-sage-700">
        {siteInfo.name}
      </div>
      {/* Center: Navigation */}
      <div className="flex flex-row items-center">
        {member && (member as any).role !== 'pending' && (
          <Navigation user={user} onLogout={onLogout} setMobileMenuOpen={setMobileMenuOpen}/>
        )}
      </div>
      {/* Right: Flags + Avatar */}
      <div className="flex items-center gap-2 relative">
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setIsLangMenuOpen((v) => !v)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-xl bg-gray-100 hover:bg-gray-200 border border-gray-300"
            aria-label="Change language"
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
        {user ? (
          <div className="hidden md:block relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen((v) => !v)}
              className="h-8 w-8 rounded-full bg-sage-600 flex items-center justify-center text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sage-500 transition-colors duration-200"
              aria-label="User menu"
            >
              {getUserInitials(member)}
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
                      onLogout();
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