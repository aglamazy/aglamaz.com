"use client";
import React from "react";
import { useSiteStore } from '@/store/SiteStore';

export default function Footer() {
  const siteInfo = useSiteStore((s) => s.siteInfo);
  const year = new Date().getFullYear();
  if (!siteInfo) return null;
  return (
    <footer className="w-full px-4 py-6 text-center text-sm text-sage-700 border-t border-sage-200">
      <p>&copy; {year} {siteInfo.name}. All rights reserved.</p>
    </footer>
  );
}
