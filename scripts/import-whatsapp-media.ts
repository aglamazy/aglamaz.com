#!/usr/bin/env tsx
/**
 * One-off import of WhatsApp-exported media into FamCircle's Photos gallery
 * (galleryPhotos collection, shown at /app/photos).
 *
 * Source: WhatsApp media export folder (IMG-YYYYMMDD-WA####.jpg / VID-...mp4
 * naming convention). Groups files by day (from the filename date) and
 * creates one galleryPhotos doc per day, matching how the app's own upload
 * flow structures a "moment" (N images/videos + one date).
 *
 * Deliberately skips: STK-*.webp (stickers, not real photos), PTT-/AUD-*.opus
 * (voice notes), .vcf (contact cards), .pdf/.enc (not gallery content).
 *
 * Usage:
 *   npx tsx scripts/import-whatsapp-media.ts --dry-run --from 20181207 --to 20181213 --chat "/path/to/_chat.txt"
 *   npx tsx scripts/import-whatsapp-media.ts --from 20181207 --to 20181213 --chat "/path/to/_chat.txt"
 *
 * --chat is optional: without it, each day's post gets an empty description
 * (the old behavior). With it, each day's title is guessed from the actual
 * chat around those photos (an occasion keyword like "חנוכה"/"גיוס" if the
 * conversation mentions one, else the nearest human caption) — always a
 * SUGGESTION, never authoritative; review/fix via the existing photo edit UI.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import * as fs from 'fs';
import sharp from 'sharp';
import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { parseChatFile, buildFilenameIndex, guessEventTitle, type ChatMessage } from './lib/whatsappChat';

const SOURCE_DIR = '/mnt/data/whatsapp-shevet-media';
const SITE_ID = 'XFptrxZIKXV6P2TjtGCL'; // aglamaz.com, confirmed via domainMappings
const CREATED_BY = 'iZ4ydKda3FOL3rSCm67nQu73TPI3'; // yaakov.aglamaz@gmail.com Firebase Auth uid
const LOCALE = 'he';
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const fromArg = args[args.indexOf('--from') + 1];
const toArg = args[args.indexOf('--to') + 1];
const chatArg = args.includes('--chat') ? args[args.indexOf('--chat') + 1] : undefined;
if (!fromArg || !toArg || !/^\d{8}$/.test(fromArg) || !/^\d{8}$/.test(toArg)) {
  console.error('Usage: import-whatsapp-media.ts [--dry-run] --from YYYYMMDD --to YYYYMMDD [--chat /path/to/_chat.txt]');
  process.exit(1);
}

let chatMessages: ChatMessage[] = [];
let chatFileIndex: Map<string, number> = new Map();
if (chatArg) {
  if (!fs.existsSync(chatArg)) {
    console.error(`--chat file not found: ${chatArg}`);
    process.exit(1);
  }
  chatMessages = parseChatFile(chatArg);
  chatFileIndex = buildFilenameIndex(chatMessages);
  console.log(`Loaded chat: ${chatMessages.length} messages, ${chatFileIndex.size} media references.`);
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
const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
if (!bucketName) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not set');
const bucket = getStorage().bucket(bucketName);

interface FileEntry {
  filename: string;
  fullPath: string;
  date: string; // YYYYMMDD
  kind: 'image' | 'video';
}

function collectFiles(): FileEntry[] {
  const all = fs.readdirSync(SOURCE_DIR);
  const entries: FileEntry[] = [];
  for (const filename of all) {
    const imgMatch = filename.match(/^IMG-(\d{8})-.*\.(jpe?g|png)$/i);
    const vidMatch = filename.match(/^VID-(\d{8})-.*\.mp4$/i);
    if (imgMatch) {
      const date = imgMatch[1];
      if (date >= fromArg && date <= toArg) {
        entries.push({ filename, fullPath: path.join(SOURCE_DIR, filename), date, kind: 'image' });
      }
    } else if (vidMatch) {
      const date = vidMatch[1];
      if (date >= fromArg && date <= toArg) {
        entries.push({ filename, fullPath: path.join(SOURCE_DIR, filename), date, kind: 'video' });
      }
    }
  }
  return entries.sort((a, b) => a.filename.localeCompare(b.filename));
}

async function uploadImage(fullPath: string, storagePath: string): Promise<{ url: string; width: number; height: number }> {
  const buffer = fs.readFileSync(fullPath);
  const { data, info } = await sharp(buffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  const file = bucket.file(storagePath);
  const downloadToken = crypto.randomUUID();
  await file.save(data, {
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
  return { url, width: info.width, height: info.height };
}

async function uploadVideo(fullPath: string, storagePath: string): Promise<string> {
  const buffer = fs.readFileSync(fullPath);
  const file = bucket.file(storagePath);
  const downloadToken = crypto.randomUUID();
  await file.save(buffer, {
    metadata: {
      contentType: 'video/mp4',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
}

function guessTitleForDay(entries: FileEntry[]): string {
  if (!chatArg) return '';
  const indices = entries
    .map((e) => chatFileIndex.get(e.filename))
    .filter((i): i is number => i !== undefined);
  const guess = guessEventTitle(chatMessages, indices);
  return guess?.title ?? '';
}

function formatTitleGuess(date: string, entries: FileEntry[]): string {
  const indices = entries
    .map((e) => chatFileIndex.get(e.filename))
    .filter((i): i is number => i !== undefined);
  const guess = guessEventTitle(chatMessages, indices);
  if (!guess) return '(none found)';
  return `"${guess.title}" [${guess.source}] <- ${guess.evidence.slice(0, 80)}`;
}

async function processWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runOne() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, runOne));
  return results;
}

async function main() {
  const files = collectFiles();
  if (files.length === 0) {
    console.log(`No IMG/VID files found between ${fromArg} and ${toArg}.`);
    return;
  }

  const byDay = new Map<string, FileEntry[]>();
  for (const f of files) {
    if (!byDay.has(f.date)) byDay.set(f.date, []);
    byDay.get(f.date)!.push(f);
  }

  console.log(`Found ${files.length} files across ${byDay.size} day(s) in range ${fromArg}-${toArg}:`);
  for (const [date, entries] of [...byDay.entries()].sort()) {
    const imgCount = entries.filter((e) => e.kind === 'image').length;
    const vidCount = entries.filter((e) => e.kind === 'video').length;
    const titleLine = chatArg ? ` — title guess: ${formatTitleGuess(date, entries)}` : '';
    console.log(`  ${date}: ${imgCount} image(s), ${vidCount} video(s)${titleLine}`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing uploaded, nothing written.');
    return;
  }

  let docsCreated = 0;
  let filesUploaded = 0;
  let errors = 0;

  for (const [date, entries] of [...byDay.entries()].sort()) {
    console.log(`\nUploading ${date} (${entries.length} files)...`);
    const images: { entry: FileEntry; result: { url: string; width: number; height: number } }[] = [];
    const videos: string[] = [];

    try {
      const uploadResults = await processWithConcurrency(entries, async (entry) => {
        const storagePath = `photos/${SITE_ID}/whatsapp-import/${date}/${entry.filename}`;
        if (entry.kind === 'image') {
          const result = await uploadImage(entry.fullPath, storagePath.replace(/\.(jpe?g|png)$/i, '.webp'));
          filesUploaded++;
          return { entry, imageResult: result };
        } else {
          const url = await uploadVideo(entry.fullPath, storagePath);
          filesUploaded++;
          return { entry, videoUrl: url };
        }
      });

      for (const r of uploadResults) {
        if ('imageResult' in r && r.imageResult) images.push({ entry: r.entry, result: r.imageResult });
        if ('videoUrl' in r && r.videoUrl) videos.push(r.videoUrl);
      }

      const [year, month, day] = [date.slice(0, 4), date.slice(4, 6), date.slice(6, 8)];
      const docDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
      const title = guessTitleForDay(entries);

      const docRef = await db.collection('galleryPhotos').add({
        siteId: SITE_ID,
        createdBy: CREATED_BY,
        date: Timestamp.fromDate(docDate),
        createdAt: Timestamp.now(),
        imagesWithDimensions: images.map((i) => i.result),
        ...(videos.length > 0 ? { videos } : {}),
        anniversaryId: null,
        taggedMemberIds: [],
        deletedAt: null,
        locales: {
          [LOCALE]: {
            description: title,
            description$meta: { source: 'whatsapp-import', updatedAt: Timestamp.now() },
          },
        },
      });
      docsCreated++;
      console.log(`  ✓ Created galleryPhotos/${docRef.id} — ${images.length} image(s), ${videos.length} video(s)${title ? ` — "${title}"` : ''}`);
    } catch (err) {
      errors++;
      console.error(`  ✗ Failed on ${date}:`, err);
    }
  }

  console.log(`\nDone. ${docsCreated} day(s) imported, ${filesUploaded} file(s) uploaded, ${errors} error(s).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
