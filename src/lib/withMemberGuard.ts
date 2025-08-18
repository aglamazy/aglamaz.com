import { NextResponse } from 'next/server';
import { ACCESS_TOKEN } from '@/constants';
import { cookies } from "next/headers";
import { importSPKI, jwtVerify } from "jose";
import { IToken } from "../entities/Token"
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";

initAdmin();
const db = getFirestore();

export function withMemberGuard(handler: Function) {
  return async (request: Request, context: any) => {
    try {
      const spki = process.env.JWT_PUBLIC_KEY!.replace(/\\n/g, '\n');
      const publicKey = await importSPKI(spki, 'RS256');
      const cookieStore = cookies();
      const token = cookieStore.get(ACCESS_TOKEN)?.value;
      const { payload } = await jwtVerify(token, publicKey, {
        algorithms: ['RS256'],
        // optionally lock these if you set them when signing:
        // issuer: 'your-app',
        // audience: 'your-app-web',
        clockTolerance: '5s',
      });
      const typedPayload = payload as IToken | undefined;
      if (!typedPayload) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      const uid = typedPayload.sub;
      if (!uid) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      context.decoded_payload = typedPayload;
      const siteId = context.params?.siteId || process.env.NEXT_SITE_ID!;
      const memberSnap = await db
        .collection('members')
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
