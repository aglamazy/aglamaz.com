import React, { useState } from "react";
import Navigation from "@/components/Navigation";

export default function Header({ user, member, onLogout, siteInfo }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="w-full flex items-center justify-between px-4 py-2 bg-white shadow-sm sticky top-0 z-50">
        {!mobileMenuOpen && (
            <div className="text-xl font-semibold text-sage-700 ml-2">
                {siteInfo?.name || 'Family App'}
            </div>
        )}
      <div className="flex flex-row items-center">
        {member && (member as any).role !== 'pending' && (
          <Navigation user={user} onLogout={onLogout} setMobileMenuOpen={setMobileMenuOpen} />
        )}
      </div>
    </header>
  );
}