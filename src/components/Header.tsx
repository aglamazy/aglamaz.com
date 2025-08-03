import React from "react";
import Navigation from "@/components/Navigation";
const handleLogout = () => {
    // setIsUserMenuOpen(false);
    // onLogout();
};
export default function Header({ user, member, onLogout, siteInfo }) {
  return (
    <header className="w-full flex items-center justify-between px-4 py-2 bg-white shadow-sm border-b border-sage-200 sticky top-0 z-50">
      <div className="text-xl font-semibold text-sage-700">
        {siteInfo?.name || 'Family App'}
      </div>
        {member && (member as any).role !== 'pending' && (
            <Navigation user={user} onLogout={handleLogout} />
        )}

    </header>
  );
}