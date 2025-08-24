'use client';
export const dynamic = 'force-dynamic';

import React from 'react';
import PendingMemberContent from '@/components/PendingMemberContent';

export default function PendingMemberPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <PendingMemberContent />
    </div>
  );
}
