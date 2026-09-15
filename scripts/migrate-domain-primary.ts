#!/usr/bin/env tsx

/**
 * Migration: backfill isPrimary on domainMappings docs for siteIds that have
 * more than one domain mapping and none marked isPrimary yet.
 *
 * Root cause this fixes: SiteRepository.getDomainBySiteId() used an unordered
 * `.where('siteId','==',siteId).limit(1)` query to build public-facing links
 * (e.g. the pending-member admin-notification email). With multiple domains
 * sharing one siteId (a leftover local-dev mapping alongside the real
 * production domain), Firestore's arbitrary doc order could pick the
 * non-production one - which is exactly what happened for the demo site
 * (`demo.famcircle.local` vs `famcircle.org`), reported by Agla 2026-09-15.
 * The code now prefers isPrimary; this backfills it so the preference has
 * something to act on instead of falling through to the same heuristic
 * every read. Run with: npx tsx scripts/migrate-domain-primary.ts [--dry-run]
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

const isNonProdHost = (domain: string) =>
  domain.endsWith('.local') || domain === 'localhost' || domain.startsWith('localhost:');

async function main(dryRun: boolean) {
  const db = getFirestore();
  const snapshot = await db.collection('domainMappings').get();

  const bySiteId = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  snapshot.forEach((doc) => {
    const siteId = doc.data().siteId as string;
    if (!siteId) return;
    const list = bySiteId.get(siteId) ?? [];
    list.push(doc);
    bySiteId.set(siteId, list);
  });

  console.log(`Found ${bySiteId.size} distinct siteId(s) across ${snapshot.size} domainMappings docs.\n`);

  let updated = 0;
  for (const [siteId, docs] of bySiteId) {
    if (docs.length < 2) continue; // unambiguous - nothing to backfill

    const alreadyPrimary = docs.find((d) => d.data().isPrimary === true);
    if (alreadyPrimary) {
      console.log(`siteId ${siteId}: already has isPrimary=${alreadyPrimary.id} - skipping`);
      continue;
    }

    const prodCandidates = docs.filter((d) => !isNonProdHost(d.id));
    const chosen = prodCandidates[0] ?? docs[0];
    console.log(
      `siteId ${siteId}: ${docs.map((d) => d.id).join(', ')} -> setting isPrimary on "${chosen.id}"`
    );

    if (!dryRun) {
      await chosen.ref.update({ isPrimary: true });
      updated++;
    }
  }

  console.log(dryRun ? '\n🧪 Dry run - no writes made.' : `\n✅ Updated ${updated} doc(s).`);
}

const dryRun = process.argv.includes('--dry-run');
main(dryRun)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
