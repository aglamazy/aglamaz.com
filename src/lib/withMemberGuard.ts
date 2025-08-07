import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initAdmin();
const db = getFirestore();

export function withMemberGuard(handler: Function) {
  return async (request: Request, context: any) => {
    try {
      const authHeader = request.headers.get('authorization');
      let token = authHeader?.replace('Bearer ', '');
      if (!token && 'cookies' in request) {
        // @ts-ignore
        token = request.cookies.get('token')?.value;
      }
      if (!token) {
        return NextResponse.json({ error: 'No authentication token provided' }, { status: 401 });
      }
      const decodedToken = await getAuth().verifyIdToken(token);
      const uid = decodedToken.uid;

      let siteId = '';
      if (context?.params?.siteId) siteId = context.params.siteId;
      else if (request.url) {
        const url = new URL(request.url);
        siteId = url.searchParams.get('siteId') || process.env.NEXT_SITE_ID || '';
      }
      if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
      }

      const memberSnap = await db
        .collection('members')
        .where('uid', '==', uid)
        .where('siteId', '==', siteId)
        .limit(1)
        .get();

      if (memberSnap.empty) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      const member = memberSnap.docs[0].data();
      return handler(request, context, decodedToken, member);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
  };
}
