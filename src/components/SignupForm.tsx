'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { User, Mail, Loader2, CheckCircle } from 'lucide-react';
import { useUserStore } from '../store/UserStore';
import { initFirebase, auth, googleProvider } from '../firebase/client';
import { signInWithPopup, getIdToken } from 'firebase/auth';
import { useRouter } from 'next/navigation';

interface SignupFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function SignupForm({ onSuccess, onCancel }: SignupFormProps) {
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { user, setUser } = useUserStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submitted:', { firstName, email, isLoading });
    
    if (!firstName.trim() || !email.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');
    console.log('Set loading to true');

    try {
      // Step 1: Authenticate with Firebase first
      initFirebase();
      if (!auth || !googleProvider) {
        throw new Error('Firebase not initialized');
      }

      const result = await signInWithPopup(auth(), googleProvider);
      const token = await getIdToken(result.user);
      
      // Set the token in cookie
      document.cookie = `token=${token}; path=/`;
      
      // Update user state
      const userData = {
        name: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        uid: result.user.uid
      };
      setUser(userData);

      // Step 2: Create pending member document
      const siteId = 'default-site';
      const response = await fetch(`/api/user/${result.user.uid}/request-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim(),
          siteId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubmitted(true);
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setError(data.error || 'Failed to submit signup request');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
      console.log('Set loading to false');
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              בקשה נשלחה בהצלחה
            </h3>
            <p className="text-gray-600">
              ממתין לאישור מהמנהל
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-xl font-bold text-gray-900">
          הרשמה למערכת
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Debug info - remove this later */}
          <div className="text-xs text-gray-500">
            Debug: firstName="{firstName}", email="{email}", isLoading={isLoading.toString()}
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              שם פרטי
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="הכנס את שמך הפרטי"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              כתובת אימייל
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="your@email.com"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={false}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  שולח...
                </>
              ) : (
                'שלח בקשה'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 