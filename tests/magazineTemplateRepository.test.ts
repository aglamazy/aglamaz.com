import assert from 'node:assert/strict';
import { MagazineTemplateRepository } from '../src/repositories/MagazineTemplateRepository';

// Minimal in-memory fake standing in for FirebaseFirestore.Firestore, just
// covering the collection().doc().get()/.set() surface the repository uses.
// There's no Firestore emulator available in this environment (needs a JVM),
// so this fake is what makes the round-trip test runnable here.
function makeFakeFirestore() {
  const store = new Map<string, Record<string, unknown>>();

  return {
    collection(name: string) {
      return {
        doc(id: string) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const data = store.get(key);
              return {
                exists: data !== undefined,
                data: () => data,
              };
            },
            async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
              const existing = opts?.merge ? store.get(key) || {} : {};
              store.set(key, { ...existing, ...data });
            },
          };
        },
      };
    },
  };
}

async function testRoundTrip() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new MagazineTemplateRepository(fakeDb);

  const before = await repo.get('site1');
  assert.equal(before, null);

  const html = '<html><body>{{siteName}} monthly digest</body></html>';
  const saved = await repo.save('site1', html, 'manual');
  assert.equal(saved.html, html);
  assert.equal(saved.source, 'manual');

  const loaded = await repo.get('site1');
  assert.ok(loaded);
  assert.equal(loaded?.html, html);
  assert.equal(loaded?.source, 'manual');
  assert.equal(loaded?.siteId, 'site1');

  console.log('magazine template round-trip test passed');
}

async function testGetMissingReturnsNull() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new MagazineTemplateRepository(fakeDb);
  const result = await repo.get('unknown-site');
  assert.equal(result, null);
  console.log('magazine template missing-site test passed');
}

async function run() {
  await testRoundTrip();
  await testGetMissingReturnsNull();
}

run();
