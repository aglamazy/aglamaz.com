#!/usr/bin/env tsx
/**
 * Non-destructive companion to import-whatsapp-media.ts: for GalleryPhoto docs
 * that were already imported (storagePath contains "whatsapp-import") but have
 * no description (imported before --chat title-guessing existed, or imported
 * without --chat), re-derive a title from the chat transcript and PATCH just
 * the description field in place. Does not touch images/videos/likes/etc.
 *
 * Usage:
 *   npx tsx scripts/backfill-whatsapp-titles.ts --dry-run --from 20181207 --to 20181213 --chat "/path/to/_chat.txt"
 *   npx tsx scripts/backfill-whatsapp-titles.ts --from 20181207 --to 20181213 --chat "/path/to/_chat.txt"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { parseChatFile, buildFilenameIndex, guessEventTitle } from './lib/whatsappChat';

const SITE_ID = 'XFptrxZIKXV6P2TjtGCL';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fromArg = args[args.indexOf('--from') + 1];
const toArg = args[args.indexOf('--to') + 1];
const chatArg = args[args.indexOf('--chat') + 1];
if (!fromArg || !toArg || !chatArg || !/^\d{8}$/.test(fromArg) || !/^\d{8}$/.test(toArg)) {
  console.error('Usage: backfill-whatsapp-titles.ts [--dry-run] --from YYYYMMDD --to YYYYMMDD --chat /path/to/_chat.txt');
  process.exit(1);
}
if (!fs.existsSync(chatArg)) {
  console.error(`--chat file not found: ${chatArg}`);
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}
const db = getFirestore();

function dateFromYYYYMMDD(d: string): { start: Date; end: Date } {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(4, 6));
  const day = Number(d.slice(6, 8));
  return {
    start: new Date(Date.UTC(y, m - 1, day, 0, 0, 0)),
    end: new Date(Date.UTC(y, m - 1, day + 1, 0, 0, 0)),
  };
}

async function main() {
  const messages = parseChatFile(chatArg);
  const fileIndex = buildFilenameIndex(messages);
  console.log(`Loaded chat: ${messages.length} messages, ${fileIndex.size} media references.`);

  const { start } = dateFromYYYYMMDD(fromArg);
  const { end } = dateFromYYYYMMDD(toArg);

  const snap = await db.collection('galleryPhotos')
    .where('siteId', '==', SITE_ID)
    .where('date', '>=', Timestamp.fromDate(start))
    .where('date', '<', Timestamp.fromDate(end))
    .where('deletedAt', '==', null)
    .get();

  console.log(`Found ${snap.size} galleryPhotos doc(s) in range ${fromArg}-${toArg}.`);

  let patched = 0;
  let skippedHasTitle = 0;
  let skippedNotWhatsapp = 0;
  let skippedNoGuess = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const currentDesc = (data.locales?.he?.description || '').trim();
    const urls: string[] = (data.imagesWithDimensions || []).map((i: { url: string }) => i.url);
    const isWhatsapp = urls.some((u) => u.includes('whatsapp-import'));
    if (!isWhatsapp) { skippedNotWhatsapp++; continue; }
    if (currentDesc) { skippedHasTitle++; continue; }

    const filenames = urls.map((u) => decodeURIComponent(u).match(/whatsapp-import\/\d{8}\/([^/?]+)\.webp/)?.[1]).filter(Boolean) as string[];
    // filenames are stored without their original extension (converted to .webp) — chat index keys on the ORIGINAL filename incl. extension.
    const indices = filenames
      .flatMap((base) => [`${base}.jpg`, `${base}.jpeg`, `${base}.png`])
      .map((f) => fileIndex.get(f))
      .filter((i): i is number => i !== undefined);

    const guess = guessEventTitle(messages, indices);
    if (!guess) { skippedNoGuess++; console.log(`  ${doc.id}: no guess found (${filenames.length} files)`); continue; }

    console.log(`  ${doc.id}: "${guess.title}" [${guess.source}] <- ${guess.evidence.slice(0, 70)}`);
    if (!DRY_RUN) {
      await doc.ref.update({
        'locales.he.description': guess.title,
        'locales.he.description$meta': { source: 'whatsapp-import-backfill', updatedAt: Timestamp.now() },
      });
      patched++;
    }
  }

  console.log(`\n${DRY_RUN ? '[dry-run] would patch' : 'Patched'} ${DRY_RUN ? snap.size - skippedHasTitle - skippedNotWhatsapp - skippedNoGuess : patched} doc(s).`);
  console.log(`Skipped: ${skippedHasTitle} already had a title, ${skippedNotWhatsapp} not whatsapp-import, ${skippedNoGuess} no guess found.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
