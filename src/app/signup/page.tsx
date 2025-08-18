'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import SignupForm from '../../components/SignupForm';

export default function SignupPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/pending-member');
  };

  const handleCancel = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <SignupForm
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
} 