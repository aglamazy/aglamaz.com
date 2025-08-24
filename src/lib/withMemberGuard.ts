import { NextResponse } from 'next/server';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/auth/service';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { RouteHandler, GuardContext } from '../app/api/types';
import { memberConverter } from '../entities/firebase/MemberDoc';

let db: Firestore | null = null;
let getCookies = cookies;

export function __setMockCookies(fn: typeof cookies) {
  getCookies = fn;
}

export function __setMockDb(mockDb: any) {
  db = mockDb;
}

export function withMemberGuard(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      if (!db) {
        initAdmin();
        db = getFirestore();
      }
      const cookieStore = getCookies();
      const token = cookieStore.get(ACCESS_TOKEN)?.value;
      const payload = token && verifyAccessToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Unauthorized (withMG, np)' }, { status: 401 });
      }
      const uid = payload.sub;
      if (!uid) {
        return NextResponse.json({ error: 'Unauthorized (withMG)' }, { status: 401 });
      }

      context.user = payload;
      const siteId = context.params?.siteId || process.env.NEXT_SITE_ID!;
      const members = db.collection('members').withConverter(memberConverter);

      const memberSnap = await members
        .where('uid', '==', uid)
        .where('siteId', '==', siteId)
        .limit(1)
        .get();

      if (memberSnap.empty) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }
      const doc = memberSnap.docs[0];
      context.member = doc.data();
      return handler(request, context);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Unauthorized (withMG, error)' }, { status: 401 });
    }
  };
}
