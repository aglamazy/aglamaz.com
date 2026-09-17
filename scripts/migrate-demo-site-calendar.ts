#!/usr/bin/env tsx

/**
 * One-time backfill: the public demo site ("Sample Family", famcircle.org)
 * predates the calendar-system feature and has no calendarSystems configured
 * at all (famcircle#177's audit, 2026-09-17). Unlike the real Aglamaz family
 * site - whose actual calendar needs are Agla's call, not ours to guess - the
 * generic demo site has no real family behind it, so Gregorian-only is a safe,
 * uncontroversial default that needs no one's judgment call.
 *
 * Run with: npx tsx scripts/migrate-demo-site-calendar.ts [--dry-run]
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const DEMO_SITE_ID = 'aYCg7N7m0HLEhpBmvew3';

async function main(dryRun: boolean) {
  const db = getFirestore();
  const ref = db.collection('sites').doc(DEMO_SITE_ID);
  const doc = await ref.get();

  if (!doc.exists) {
    console.log(`Site ${DEMO_SITE_ID} not found - nothing to do.`);
    return;
  }

  const data = doc.data();
  if (Array.isArray(data?.calendarSystems) && data.calendarSystems.length > 0) {
    console.log(`Site ${DEMO_SITE_ID} already has calendarSystems=${JSON.stringify(data.calendarSystems)} - skipping.`);
    return;
  }

  console.log(`Site ${DEMO_SITE_ID} (${data?.name}): setting calendarSystems=['gregorian'], defaultCalendarSystem='gregorian'`);
  if (!dryRun) {
    await ref.update({ calendarSystems: ['gregorian'], defaultCalendarSystem: 'gregorian' });
    console.log('✅ Updated.');
  } else {
    console.log('🧪 Dry run - no write made.');
  }
}

const dryRun = process.argv.includes('--dry-run');
main(dryRun)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
