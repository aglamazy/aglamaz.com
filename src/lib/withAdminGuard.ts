import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

initAdmin();
const db = getFirestore();

export function withAdminGuard(handler: Function) {
  return async (request: Request, context: any) => {
    try {
      // Extract token from Authorization header or cookies
      const authHeader = request.headers.get('authorization');
      let token = authHeader?.replace('Bearer ', '');
      if (!token && 'cookies' in request) {
        // @ts-ignore
        token = request.cookies.get('token')?.value;
      }
      if (!token) {
        return NextResponse.json({ error: 'No authentication token provided' }, { status: 401 });
      }
      // Verify token
      const decodedToken = await getAuth().verifyIdToken(token);
      const uid = decodedToken.uid;
      // Try to get siteId from query or context
      let siteId = '';
      if (context?.params?.siteId) siteId = context.params.siteId;
      else if (request.url) {
        const url = new URL(request.url);
        siteId = url.searchParams.get('siteId') || '';
      }
      // Fallback: allow if no siteId (customize as needed)
      if (!siteId) {
        return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
      }
      // Check admin role
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
      if (member.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
      }
      // Call the actual handler
      return handler(request, context, decodedToken, member);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
  };
} 