import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export const POST = async (_request: Request, { params }: { params: { postId: string } }) => {
  try {
    initAdmin();
    const db = getFirestore();
    const ref = db.collection('blogPosts').doc(params.postId);
    await ref.update({ shareCount: FieldValue.increment(1) });
    const snap = await ref.get();
    return Response.json({ shareCount: snap.data()?.shareCount ?? 0 });
  } catch (error) {
    console.error('Failed to increment share:', error);
    return Response.json({ error: 'Failed to increment share' }, { status: 500 });
  }
};
