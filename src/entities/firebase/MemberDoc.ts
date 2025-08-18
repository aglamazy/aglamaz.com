// types
export interface MemberDoc {
  uid: string;
  siteId: string;
  role?: string;
  [k: string]: unknown;
}

// converter
export const memberConverter: FirebaseFirestore.FirestoreDataConverter<MemberDoc> = {
  toFirestore(m: MemberDoc) {
    return m as FirebaseFirestore.DocumentData;
  },
  fromFirestore(snap: FirebaseFirestore.QueryDocumentSnapshot) {
    const data = snap.data();
    // minimal runtime guard to satisfy TS & avoid bad data
    if (typeof data.uid !== 'string' || typeof data.siteId !== 'string') {
      throw new Error('Invalid member document');
    }
    return { ...data } as MemberDoc;
  },
};
