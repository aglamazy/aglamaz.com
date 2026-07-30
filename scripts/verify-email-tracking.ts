#!/usr/bin/env tsx
/**
 * Real-path verification for famcircle#121 (email open/click analytics).
 *
 * Reads the emailTrackingEvents collection directly - the per-recipient opened/clicked
 * table the task's DoD asks for. Run this AFTER curling a pixel/click URL, or after a
 * real digest send + a mail-client-style fetch of the resulting pixel URL.
 *
 * Usage:
 *   npx tsx scripts/verify-email-tracking.ts                                   # last 20 events, any send
 *   npx tsx scripts/verify-email-tracking.ts --recent 50                       # last 50 events
 *   npx tsx scripts/verify-email-tracking.ts <siteId> <sendType> <sendId>      # one send's table
 *
 * Example (after `curl http://localhost:3000/api/track/pixel/<token>`):
 *   npx tsx scripts/verify-email-tracking.ts site123 digest monthly:2026-07
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { initAdmin } from '../src/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { EmailTrackingSendType } from '../src/services/EmailTrackingService';

function printRow(id: string, d: FirebaseFirestore.DocumentData) {
  const ts = d.timestamp?.toDate?.() ?? d.timestamp;
  console.log(
    `- [${id}] ${ts}  ${d.eventType}  site=${d.siteId}  recipient=${d.recipientMemberId}  sendType=${d.sendType}  sendId=${d.sendId}  ua=${d.userAgent ?? '(none)'}`,
  );
}

async function main() {
  initAdmin();
  const db = getFirestore();

  if (process.argv[2] === '--recent' || !process.argv[2]) {
    const limit = process.argv[2] === '--recent' ? parseInt(process.argv[3] || '20', 10) : 20;
    const snap = await db.collection('emailTrackingEvents').orderBy('timestamp', 'desc').limit(limit).get();
    console.log(`Last ${snap.size} emailTrackingEvents entries:\n`);
    snap.forEach((doc) => printRow(doc.id, doc.data()));
    return;
  }

  const [siteId, sendType, sendId] = process.argv.slice(2) as [string, EmailTrackingSendType, string];
  const snap = await db
    .collection('emailTrackingEvents')
    .where('siteId', '==', siteId)
    .where('sendType', '==', sendType)
    .where('sendId', '==', sendId)
    .get();

  console.log(`${snap.size} event(s) for site=${siteId} sendType=${sendType} sendId=${sendId}:\n`);
  const rows = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as any)
    .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  for (const row of rows) printRow(row.id, row);

  const opened = new Set(rows.filter((r) => r.eventType === 'open').map((r) => r.recipientMemberId));
  const clicked = new Set(rows.filter((r) => r.eventType === 'click').map((r) => r.recipientMemberId));
  console.log(`\nUnique recipients opened: ${opened.size}   clicked: ${clicked.size}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
