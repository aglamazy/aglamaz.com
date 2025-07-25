"use client";
import React, { useState } from "react";
import { FcGoogle } from "react-icons/fc";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-4 shadow">
            {/* Placeholder for logo */}
            <span className="text-4xl">🌳</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">Welcome to FamilyCircle <span className="block">(Copy)</span></h1>
          <p className="text-gray-500 mt-2 text-center">Sign in to continue</p>
        </div>
        {/* Google Login */}
        <button className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 mb-4 font-medium text-gray-700 hover:bg-gray-100 transition">
          <FcGoogle className="text-xl" />
          Continue with Google
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
        <button className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition mb-4">Sign in</button>
        {/* Links */}
        <div className="flex justify-between w-full text-sm text-gray-500">
          <a href="#" className="hover:underline">Forgot password?</a>
          <a href="#" className="hover:underline">Need an account? <span className="font-semibold">Sign up</span></a>
        </div>
      </div>
    </div>
  );
} 