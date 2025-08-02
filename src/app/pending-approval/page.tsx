'use client';

import React from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function PendingApprovalPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl" lang="he">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
        <div className="mx-auto mb-4">
          <Clock className="w-16 h-16 text-yellow-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">ממתין לאישור</h2>
        <p className="text-gray-600">בקשה שלך נשלחה בהצלחה למנהל המערכת.</p>
        <p className="text-gray-600">תקבל הודעה כאשר הבקשה תאושר.</p>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-800">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">בקשה נשלחה בהצלחה</span>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">ממתין לאישור מהמנהל</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-8">
          <Link href="/contact" passHref legacyBehavior>
            <Button className="w-full bg-black text-white rounded hover:bg-gray-800">צור קשר</Button>
          </Link>
          <Button className="w-full bg-gray-200 text-gray-800 rounded hover:bg-gray-300" onClick={handleLogout} type="button">התנתק</Button>
        </div>
      </div>
    </div>
  );
}
