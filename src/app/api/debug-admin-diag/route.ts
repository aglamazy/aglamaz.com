// TEMPORARY diagnostic route for a live incident (2026-07-24) — login broken in
// production with a Firebase "incorrect aud claim" error. Reports shape-only
// info (lengths, prefixes) about server-side Firebase Admin config, never full
// secret values. DELETE after the incident is resolved.
import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/admin';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const dynamic = 'force-dynamic';

function mask(value: string, headLen = 16, tailLen = 16): string {
  if (!value) return '(empty)';
  if (value.length <= headLen + tailLen) return `${value.slice(0, 4)}....${value.slice(-4)} (len=${value.length})`;
  return `${value.slice(0, headLen)}....${value.slice(-tailLen)} (len=${value.length})`;
}

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
      FIREBASE_PROJECT_ID: mask(projectIdEnv),
      FIREBASE_CLIENT_EMAIL: mask(clientEmailEnv),
      FIREBASE_PRIVATE_KEY: {
        masked: mask(privateKeyEnv, 20, 10),
        hasLiteralBackslashN: privateKeyEnv.includes('\\n'),
        hasRealNewline: privateKeyEnv.includes('\n'),
      },
    },
    appsRegisteredCount: getApps().length,
    appOptionsProjectId: mask(String(appOptionsProjectId), 20, 10),
    initError,
  });
}
