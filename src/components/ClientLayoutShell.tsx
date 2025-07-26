'use client';
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPageUrl } from "../utils/createPageUrl";
import { Home, BookOpen, Link as LinkIcon, Images, Users, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import { User } from "../entities/User";
import { useSiteStore } from '../store/SiteStore';
import { useRouter } from "next/navigation";

// Sidebar stubs
const Sidebar = ({ children, className }) => <aside className={className}>{children}</aside>;
const SidebarContent = ({ children, className }) => <div className={className}>{children}</div>;
const SidebarGroup = ({ children }) => <div>{children}</div>;
const SidebarGroupContent = ({ children }) => <div>{children}</div>;
const SidebarGroupLabel = ({ children, className }) => <div className={className}>{children}</div>;
const SidebarMenu = ({ children }) => <ul>{children}</ul>;
const SidebarMenuButton = ({ children, asChild, className }) => <div className={className}>{children}</div>;
const SidebarMenuItem = ({ children }) => <li>{children}</li>;
const SidebarHeader = ({ children, className }) => <div className={className}>{children}</div>;
const SidebarFooter = ({ children, className }) => <div className={className}>{children}</div>;
const SidebarProvider = ({ children }) => <>{children}</>;
const SidebarTrigger = ({ className }) => <button className={className}>☰</button>;

const navigationItems = [
  {
    title: "Family Home",
    url: createPageUrl("Home"),
    icon: Home,
  },
  {
    title: "Family Blog",
    url: createPageUrl("Blog"),
    icon: BookOpen,
  },
  {
    title: "Family Links",
    url: createPageUrl("Links"),
    icon: LinkIcon,
  },
  {
    title: "Photo Albums",
    url: createPageUrl("Albums"),
    icon: Images,
  },
];

export default function ClientLayoutShell({ children }) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const setSiteInfo = useSiteStore((state) => state.setSiteInfo);
  const siteInfo = useSiteStore((state) => state.siteInfo);
  const familyName = siteInfo?.name || 'Family';
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  React.useEffect(() => {
    // Hydrate Zustand store with site info from server
    try {
      const script = document.getElementById('__SITE_INFO__');
      if (script) {
        const info = JSON.parse(script.textContent || '{}');
        setSiteInfo(info);
      }
    } catch (error) {
      console.error('Failed to parse site info:', error);
      setSiteInfo({ name: 'Family' }); // fallback
    }
  }, [setSiteInfo]);

  const checkAuth = async () => {
    try {
      const userData = await User.me();
      setUser(userData);
    } catch (error) {
      setUser(null);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setUser(null);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-sage-50">
        <style>{`
          :root {
            --cream-50: #FEFCF8;
            --cream-100: #FDF8F0;
            --sage-50: #F7F8F6;
            --sage-100: #E8EBE6;
            --sage-200: #D1D8CC;
            --sage-300: #A8B5A0;
            --sage-400: #8B9A7B;
            --sage-500: #6B7A5E;
            --sage-600: #566249;
            --sage-700: #454F3B;
            --sage-800: #373F2F;
            --sage-900: #2C3E36;
            --charcoal: #2C3E36;
          }
          .bg-cream-50 { background-color: var(--cream-50); }
          .bg-cream-100 { background-color: var(--cream-100); }
          .bg-sage-50 { background-color: var(--sage-50); }
          .bg-sage-100 { background-color: var(--sage-100); }
          .bg-sage-600 { background-color: var(--sage-600); }
          .bg-sage-700 { background-color: var(--sage-700); }
          .text-sage-600 { color: var(--sage-600); }
          .text-sage-700 { color: var(--sage-700); }
          .text-charcoal { color: var(--charcoal); }
          .border-sage-200 { border-color: var(--sage-200); }
          .border-sage-600 { border-color: var(--sage-600); }
          .hover\:bg-sage-700:hover { background-color: var(--sage-700); }
          .hover\:border-sage-300:hover { border-color: var(--sage-300); }
        `}</style>
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <style>{`
          :root {
            --cream-50: #FEFCF8;
            --cream-100: #FDF8F0;
            --sage-50: #F7F8F6;
            --sage-100: #E8EBE6;
            --sage-200: #D1D8CC;
            --sage-300: #A8B5A0;
            --sage-400: #8B9A7B;
            --sage-500: #6B7A5E;
            --sage-600: #566249;
            --sage-700: #454F3B;
            --sage-800: #373F2F;
            --sage-900: #2C3E36;
            --charcoal: #2C3E36;
          }
          .bg-cream-50 { background-color: var(--cream-50); }
          .bg-cream-100 { background-color: var(--cream-100); }
          .bg-sage-50 { background-color: var(--sage-50); }
          .bg-sage-100 { background-color: var(--sage-100); }
          .bg-sage-600 { background-color: var(--sage-600); }
          .bg-sage-700 { background-color: var(--sage-700); }
          .text-sage-600 { color: var(--sage-600); }
          .text-sage-700 { color: var(--sage-700); }
          .text-charcoal { color: var(--charcoal); }
          .border-sage-200 { border-color: var(--sage-200); }
          .border-sage-600 { border-color: var(--sage-600); }
          .hover\:bg-sage-700:hover { background-color: var(--sage-700); }
          .hover\:border-sage-300:hover { border-color: var(--sage-300); }
        `}</style>
        <Sidebar className="border-r border-sage-200 bg-white">
          <SidebarHeader className="border-b border-sage-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sage-600 to-sage-700 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-charcoal">{familyName}</h2>
                <p className="text-sm text-sage-600">Family Portal</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-sage-700 uppercase tracking-wider px-3 py-2">
                Family Hub
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-sage-100 transition-all duration-200 rounded-xl mb-1 ${
                          pathname === item.url ? 'bg-sage-100 text-sage-700 font-medium' : 'text-charcoal'
                        }`}
                      >
                        <Link href={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sage-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-sage-100 rounded-full flex items-center justify-center">
                  <span className="text-sage-700 font-semibold text-sm">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-charcoal text-sm truncate">
                    {user?.full_name || 'Family Member'}
                  </p>
                  <p className="text-xs text-sage-600 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleLogout}
                className="text-sage-600 hover:text-sage-700 hover:bg-sage-100"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col bg-gradient-to-br from-cream-50 to-sage-50">
          <header className="bg-white/80 backdrop-blur-sm border-b border-sage-200 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-sage-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-charcoal">{familyName}</h1>
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
} 