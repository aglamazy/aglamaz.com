'use client';

import React from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
      </div>
    </div>
  );
}
