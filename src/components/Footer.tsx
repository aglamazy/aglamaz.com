"use client";
import React from "react";
import { ISite } from "@/entities/Site";

interface FooterProps {
  siteInfo: ISite;
}

export default function Footer({ siteInfo }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="w-full px-4 py-6 text-center text-sm text-sage-700 border-t border-sage-200">
      <p>&copy; {year} {siteInfo.name}. All rights reserved.</p>
    </footer>
  );
}
