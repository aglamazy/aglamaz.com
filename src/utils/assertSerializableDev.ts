// utils/assertSerializableDev.ts (dev only)
export function assertSerializableDev(obj: any, path = 'prop') {
  const t = Object.prototype.toString.call(obj); // למשל "[object Object]"
  const isPlainObj = t === '[object Object]';

  // זיהוי טיפוסים חשודים (כולל פיירסטור)
  const isFirestoreTimestamp = !!obj?.toDate && typeof obj.toDate === 'function';
  const isFirestoreDocSnap  = !!obj?.data && typeof obj.data === 'function';
  const isGeoPoint = typeof obj?.latitude === 'number' && typeof obj?.longitude === 'number';

  if (isFirestoreTimestamp) throw new Error(`Non-serializable Firestore Timestamp at ${path}`);
  if (isFirestoreDocSnap)  throw new Error(`Non-serializable Firestore DocumentSnapshot at ${path}`);
  if (isGeoPoint)          throw new Error(`Non-serializable Firestore GeoPoint at ${path}`);

  if (obj instanceof Map)  throw new Error(`Non-serializable Map at ${path}`);
  if (obj instanceof Set)  throw new Error(`Non-serializable Set at ${path}`);
  if (obj instanceof URL)  throw new Error(`Non-serializable URL at ${path}`);
  if (obj instanceof RegExp) throw new Error(`Non-serializable RegExp at ${path}`);

  // אובייקט עם prototype null
  if (isPlainObj === false && typeof obj === 'object' && obj !== null && !Array.isArray(obj) && !(obj instanceof Date)) {
    throw new Error(`Non-serializable object type ${t} at ${path}`);
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) assertSerializableDev(obj[i], `${path}[${i}]`);
    return;
  }

  if (isPlainObj) {
    for (const [k, v] of Object.entries(obj)) assertSerializableDev(v as any, `${path}.${k}`);
  }
}
