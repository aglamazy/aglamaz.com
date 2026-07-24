// TEMPORARY diagnostic route for a live incident (2026-07-24) — login broken in
// production with a Firebase "incorrect aud claim" error. Reports shape-only
// info (lengths, prefixes) about server-side Firebase Admin config, never full
// secret values. DELETE after the incident is resolved.
import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/admin';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || '';
  const clientEmailEnv = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKeyEnv = process.env.FIREBASE_PRIVATE_KEY || '';

  let appOptionsProjectId = 'INIT_FAILED';
  let initError: string | null = null;
  try {
    initAdmin();
    const app = getApps()[0];
    appOptionsProjectId = (app?.options as any)?.projectId ?? 'undefined';
    // Force auth() construction to see if IT throws separately from initializeApp
    getAuth();
  } catch (e: any) {
    initError = String(e?.message || e);
  }

  return NextResponse.json({
    env: {
      FIREBASE_PROJECT_ID: { len: projectIdEnv.length, prefix: projectIdEnv.slice(0, 4), suffix: projectIdEnv.slice(-4) },
      FIREBASE_CLIENT_EMAIL: { len: clientEmailEnv.length, prefix: clientEmailEnv.slice(0, 6), suffix: clientEmailEnv.slice(-12) },
      FIREBASE_PRIVATE_KEY: { len: privateKeyEnv.length, hasLiteralBackslashN: privateKeyEnv.includes('\\n'), hasRealNewline: privateKeyEnv.includes('\n'), prefix: privateKeyEnv.slice(0, 30) },
    },
    appsRegisteredCount: getApps().length,
    appOptionsProjectId,
    initError,
  });
}
