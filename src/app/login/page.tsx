"use client";
import React, { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { initFirebase, auth, googleProvider } from "../../firebase/client";
import { signInWithPopup, getIdToken, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useSiteStore } from "../../store/SiteStore";
import { useUserStore } from "../../store/UserStore";
import SignupForm from "../../components/SignupForm";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const router = useRouter();
  const { siteInfo } = useSiteStore();
  const { setUser } = useUserStore();

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError("");
      initFirebase();
      if (auth && googleProvider) {
        const result = await signInWithPopup(auth(), googleProvider);
        const token = await getIdToken(result.user);
        document.cookie = `token=${token}; path=/`;

        // Update user state immediately after login
        setUser({
          name: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
          uid: result.user.uid
        });

        try {
          const firstName = result.user.displayName?.split(' ')[0] || '';
          await fetch(`/api/user/${result.user.uid}/request-signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName,
              email: result.user.email,
              siteId: siteInfo?.id
            })
          });
        } catch (err) {
          console.error('Failed to submit signup request', err);
        }

        router.push("/");
      }
    } catch (error) {
      setError("Google login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      initFirebase();
      if (auth) {
        const result = await signInWithEmailAndPassword(auth(), email, password);
        const token = await getIdToken(result.user);
        document.cookie = `token=${token}; path=/`;
        
        // Update user state immediately after login
        setUser({
          name: result.user.displayName || result.user.email,
          email: result.user.email,
          photoURL: result.user.photoURL,
          uid: result.user.uid
        });
        
        router.push("/");
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError("Invalid email or password");
      } else if (error.code === 'auth/too-many-requests') {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      initFirebase();
      if (auth) {
        await sendPasswordResetEmail(auth(), email);
        alert("Password reset email sent! Check your inbox.");
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setError("No account found with this email address");
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showSignup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <SignupForm
          onSuccess={() => router.push('/pending-approval')}
          onCancel={() => setShowSignup(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-4 shadow">
            {/* Placeholder for logo */}
            <span className="text-4xl">🌳</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">Welcome to {siteInfo?.name || 'FamilyCircle'}</h1>
          <p className="text-gray-500 mt-2 text-center">Sign in to continue</p>
        </div>
        {/* Error Message */}
        {error && (
          <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Google Login */}
        <button
          className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 mb-4 font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <FcGoogle className="text-xl" />
          {isLoading ? "Signing in..." : "Continue with Google"}
        </button>
        <div className="flex items-center w-full my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="mx-2 text-gray-400 text-sm">OR</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        {/* Email Input */}
        <div className="w-full mb-3">
          <label className="block text-gray-700 text-sm mb-1" htmlFor="email">Email</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 7.5V16.5C21 18.1569 19.6569 19.5 18 19.5H6C4.34315 19.5 3 18.1569 3 16.5V7.5M21 7.5C21 5.84315 19.6569 4.5 18 4.5H6C4.34315 4.5 3 5.84315 3 7.5M21 7.5L12 13.5L3 7.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <input
              id="email"
              type="email"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        </div>
        {/* Password Input */}
        <div className="w-full mb-6">
          <label className="block text-gray-700 text-sm mb-1" htmlFor="password">Password</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 11V7A5 5 0 0 0 7 7v4M5 11h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <input
              id="password"
              type="password"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="********"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        </div>
        {/* Sign In Button */}
        <button 
          className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleEmailLogin}
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
        {/* Links */}
        <div className="flex justify-between w-full text-sm text-gray-500">
          <button 
            onClick={handleForgotPassword}
            className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Forgot password?
          </button>
          <Link href="/contact" className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            Contact Us
          </Link>
          <button 
            onClick={() => setShowSignup(true)}
            className="hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
} 