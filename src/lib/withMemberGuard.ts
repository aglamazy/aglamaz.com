import { NextResponse } from 'next/server';
import { ACCESS_TOKEN } from '@/auth/cookies';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/auth/service';
import { initAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { RouteHandler, GuardContext } from '../app/api/types';
import { memberConverter } from '../entities/firebase/MemberDoc';

initAdmin();
const db = getFirestore();

export function withMemberGuard(handler: Function): RouteHandler {
  return async (request: Request, context: GuardContext) => {
    try {
      const cookieStore = cookies();
      const token = cookieStore.get(ACCESS_TOKEN)?.value;
      const payload = token && verifyAccessToken(token);
      if (!payload) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      const uid = payload.sub;
      if (!uid) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      context.decoded_payload = payload;
      const siteId = context.params?.siteId || process.env.NEXT_SITE_ID!;
      const members = db.collection('members').withConverter(memberConverter);

      const memberSnap = await members
        .where('uid', '==', uid)
        .where('siteId', '==', siteId)
        .limit(1)
        .get();

      if (memberSnap.empty) {
        return NextResponse.redirect(new URL('/pending-member', request.url));
      }
      const doc = memberSnap.docs[0];
      context.member = doc.data();
      return handler(request, context);
    } catch (error) {
      console.error(error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  };
}
