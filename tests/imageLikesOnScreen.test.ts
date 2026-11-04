// famcircle#199 (Agla chose option a, 2026-11-03): likes are read only for the photos on
// screen. Each like read is one Firestore collection get, so the set of (item, index) pairs
// the repository is called with IS the billed read count. These tests stub the repository
// and assert that set exactly, on both routes' logic, plus the by-index response shape.
import assert from 'node:assert/strict';
import type { ImageLikesResult } from '../src/repositories/ImageLikeRepository';
import { fetchOccurrenceLikes, fetchPictureLikes, type LikesReader } from '../src/services/ImageLikesQuery';
import { LikeRequestTracker } from '../src/utils/likeRequestTracker';
import { parseIndexList, parseIndexArray } from '../src/utils/imageIndexes';

/** The wedding occurrence Agla imported from Dropbox. */
const WEDDING_PHOTOS = 1041;
const OCC = 'wedding-occ';

type Call = { kind: 'gallery' | 'occurrence'; id: string; index: number };

/** A repository stub whose result for image i carries a count unique to i (i * 10 + 7). */
function stubReader(): { reader: LikesReader; calls: Call[] } {
  const calls: Call[] = [];
  const result = (index: number): ImageLikesResult => ({ index, count: index * 10 + 7, likedByMe: index % 2 === 0, likers: [] });
  const reader: LikesReader = {
    async getLikesForImage(photoId, imageIndex) {
      calls.push({ kind: 'gallery', id: photoId, index: imageIndex });
      return result(imageIndex);
    },
    async getLikesForOccurrenceImage(occurrenceId, imageIndex) {
      calls.push({ kind: 'occurrence', id: occurrenceId, index: imageIndex });
      return result(imageIndex);
    },
  };
  return { reader, calls };
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
const pairs = (calls: Call[]) => calls.map((c) => `${c.kind}:${c.id}:${c.index}`).sort();

async function testPicturesSparseReadsExactlyThoseIndexes() {
  const { reader, calls } = stubReader();
  const wanted = range(60, 120);
  const out = await fetchPictureLikes(reader, [{ id: OCC, type: 'occurrence', indexes: wanted }], 'u1', 's1');
  assert.ok(out.ok);
  assert.deepEqual(pairs(calls), wanted.map((i) => `occurrence:${OCC}:${i}`).sort());
  assert.equal(calls.length, 60);
  assert.ok(calls.every((c) => c.index >= 60 && c.index < 120), 'never index 0..59');
}

async function testPicturesByIndexMapsToTheRightPhoto() {
  const { reader } = stubReader();
  const out = await fetchPictureLikes(reader, [{ id: OCC, type: 'occurrence', indexes: [60, 61, 1040] }], 'u1', 's1');
  assert.ok(out.ok && 'body' in out);
  const byIndex = out.body.byIndex[OCC];
  assert.deepEqual(Object.keys(byIndex).map(Number).sort((a, b) => a - b), [60, 61, 1040]);
  for (const i of [60, 61, 1040]) {
    assert.equal(byIndex[i].index, i);
    assert.equal(byIndex[i].count, i * 10 + 7, `photo ${i} must carry photo ${i}'s likes`);
  }
  // Over the wire the keys are strings; reading by index still lands on the right photo.
  const wire = JSON.parse(JSON.stringify(out.body)).byIndex[OCC];
  assert.equal(wire[60].count, 607);
  assert.equal(wire[0], undefined, 'nothing at position 0 when 0 was not asked');
  assert.deepEqual(out.body.likes, {}, 'indexed requests get no legacy arrays');
}

async function testPicturesGalleryAndMixedItems() {
  const { reader, calls } = stubReader();
  const out = await fetchPictureLikes(
    reader,
    [
      { id: 'g1', type: 'gallery', indexes: [0, 2] },
      { id: OCC, type: 'occurrence', indexes: [5] },
    ],
    'u1',
    's1',
  );
  assert.ok(out.ok);
  assert.deepEqual(pairs(calls), ['gallery:g1:0', 'gallery:g1:2', `occurrence:${OCC}:5`].sort());
}

async function testPicturesIndexesWinOverImageCount() {
  const { reader, calls } = stubReader();
  await fetchPictureLikes(reader, [{ id: OCC, type: 'occurrence', imageCount: WEDDING_PHOTOS, indexes: [3] }], 'u1', 's1');
  assert.deepEqual(pairs(calls), [`occurrence:${OCC}:3`]);
}

/** A client bundle cached from before famcircle#199 still sends imageCount and reads arrays. */
async function testPicturesLegacyImageCountUnchanged() {
  const { reader, calls } = stubReader();
  const out = await fetchPictureLikes(reader, [{ id: OCC, type: 'occurrence', imageCount: 4 }], 'u1', 's1');
  assert.ok(out.ok && 'body' in out);
  assert.deepEqual(pairs(calls), range(0, 4).map((i) => `occurrence:${OCC}:${i}`).sort());
  assert.deepEqual(out.body.likes[OCC].map((r) => r.index), [0, 1, 2, 3]);
  assert.deepEqual(out.body.byIndex, {});
}

async function testPicturesRejectsBadIndexes() {
  const { reader, calls } = stubReader();
  for (const bad of [[-1], [1.5], ['3'], [], 'all']) {
    const out = await fetchPictureLikes(reader, [{ id: OCC, type: 'occurrence', indexes: bad }], 'u1', 's1');
    assert.ok('error' in out, `indexes ${JSON.stringify(bad)} must be refused`);
  }
  const empty = await fetchPictureLikes(reader, [], 'u1', 's1');
  assert.ok('error' in empty);
  assert.equal(calls.length, 0, 'a refused request reads nothing');
}

async function testEventSparseReadsExactlyThoseIndexes() {
  const { reader, calls } = stubReader();
  const out = await fetchOccurrenceLikes(reader, OCC, WEDDING_PHOTOS, range(60, 120).join(','), 'u1', 's1');
  assert.ok(out.ok && 'body' in out);
  assert.deepEqual(pairs(calls), range(60, 120).map((i) => `occurrence:${OCC}:${i}`).sort());
  assert.ok('byIndex' in out.body);
  const byIndex = out.body.byIndex;
  assert.equal(byIndex[60].count, 607);
  assert.equal(byIndex[119].count, 1197);
  assert.equal(byIndex[0], undefined);
}

/** No ?indexes= (an un-updated caller): every image, positional { items }, as before. */
async function testEventNoIndexesBehavesAsToday() {
  const { reader, calls } = stubReader();
  const out = await fetchOccurrenceLikes(reader, OCC, 5, null, 'u1', 's1');
  assert.ok(out.ok && 'body' in out);
  assert.deepEqual(pairs(calls), range(0, 5).map((i) => `occurrence:${OCC}:${i}`).sort());
  assert.ok('items' in out.body);
  assert.deepEqual(out.body.items.map((r) => r.index), [0, 1, 2, 3, 4]);
}

async function testEventRejectsOutOfRangeAndJunk() {
  const { reader, calls } = stubReader();
  for (const bad of [String(WEDDING_PHOTOS), '1,x', '', '-2', '1,,2']) {
    const out = await fetchOccurrenceLikes(reader, OCC, WEDDING_PHOTOS, bad, 'u1', 's1');
    assert.ok('error' in out, `indexes "${bad}" must be refused`);
  }
  assert.equal(calls.length, 0);
}

function testParsersDedupe() {
  const a = parseIndexArray([3, 1, 3]);
  assert.ok('indexes' in a);
  assert.deepEqual(a.indexes, [1, 3]);
  const l = parseIndexList('5, 2,5');
  assert.ok('indexes' in l);
  assert.deepEqual(l.indexes, [2, 5]);
}

/**
 * The client side of the count: the photos feed asks for the mounted tiles, 60 per scroll
 * step. Simulated over the 1041-photo occurrence: first screen, full scroll, then scroll
 * back up - which must ask for nothing.
 */
function testFeedReadsPerLoadAndScroll() {
  const STEP = 60;
  const tracker = new LikeRequestTracker();
  const asked: number[][] = [];
  const mount = (visible: number) => {
    const fresh = tracker.take(OCC, range(0, Math.min(visible, WEDDING_PHOTOS)));
    if (fresh.length) asked.push(fresh);
  };

  mount(STEP);
  assert.equal(tracker.askedCount, 60, 'first screen asks 60, not 1041');
  assert.deepEqual(asked[0], range(0, 60));

  mount(2 * STEP);
  assert.deepEqual(asked[1], range(60, 120), 'the next step asks only the new tiles');

  for (let v = 3 * STEP; v < WEDDING_PHOTOS + STEP; v += STEP) mount(v);
  assert.equal(tracker.askedCount, WEDDING_PHOTOS, 'a full scroll still costs every photo once');
  assert.equal(asked.length, Math.ceil(WEDDING_PHOTOS / STEP));

  const before = asked.length;
  mount(STEP); // scrolled back to the top, the same tiles re-render
  mount(WEDDING_PHOTOS);
  assert.equal(asked.length, before, 'scrolling back asks for nothing');

  tracker.release(OCC, [5]);
  assert.deepEqual(tracker.take(OCC, range(0, 10)), [5], 'a failed index is asked again');
}

async function main() {
  await testPicturesSparseReadsExactlyThoseIndexes();
  await testPicturesByIndexMapsToTheRightPhoto();
  await testPicturesGalleryAndMixedItems();
  await testPicturesIndexesWinOverImageCount();
  await testPicturesLegacyImageCountUnchanged();
  await testPicturesRejectsBadIndexes();
  await testEventSparseReadsExactlyThoseIndexes();
  await testEventNoIndexesBehavesAsToday();
  await testEventRejectsOutOfRangeAndJunk();
  testParsersDedupe();
  testFeedReadsPerLoadAndScroll();
  console.log('imageLikesOnScreen tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
