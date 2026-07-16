import assert from 'node:assert/strict';
import { NotificationPreferencesRepository } from '../src/repositories/NotificationPreferencesRepository';

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
                data: () => data ?? undefined,
              };
            },
            async set(data: Record<string, unknown>, opts?: { merge?: boolean }) {
              const existing = opts?.merge ? store.get(key) ?? {} : {};
              store.set(key, { ...existing, ...data });
            },
          };
        },
      };
    },
  };
}

async function testGetReturnsNullWhenMissing() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new NotificationPreferencesRepository(fakeDb);
  const result = await repo.get('member-x');
  assert.equal(result, null);
  console.log('get-missing returns null: PASS');
}

async function testSetAndGet() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new NotificationPreferencesRepository(fakeDb);

  await repo.setMagazineOptOut('member-1', 'site-1', true);
  const prefs = await repo.get('member-1');
  assert.ok(prefs, 'prefs should exist after set');
  assert.equal(prefs.memberId, 'member-1');
  assert.equal(prefs.siteId, 'site-1');
  assert.equal(prefs.magazineOptOut, true);
  assert.equal(prefs.birthOptOut, false);
  console.log('set magazineOptOut=true + get: PASS');
}

async function testToggleOptOut() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new NotificationPreferencesRepository(fakeDb);

  await repo.setMagazineOptOut('member-2', 'site-1', true);
  await repo.setMagazineOptOut('member-2', 'site-1', false);
  const prefs = await repo.get('member-2');
  assert.ok(prefs);
  assert.equal(prefs.magazineOptOut, false);
  console.log('toggle opt-out back to false: PASS');
}

async function testMergePreservesOtherFields() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new NotificationPreferencesRepository(fakeDb);

  // Simulate a pre-existing doc with birthOptOut set (as famcircle#11 would write it)
  const col = (fakeDb as any).collection('notificationPreferences');
  const docRef = col.doc('member-3');
  await docRef.set({ memberId: 'member-3', siteId: 'site-1', birthOptOut: true });

  await repo.setMagazineOptOut('member-3', 'site-1', true);
  const prefs = await repo.get('member-3');
  assert.ok(prefs);
  assert.equal(prefs.magazineOptOut, true);
  assert.equal(prefs.birthOptOut, true, 'existing birthOptOut should be preserved by merge');
  console.log('merge preserves existing fields: PASS');
}

async function run() {
  await testGetReturnsNullWhenMissing();
  await testSetAndGet();
  await testToggleOptOut();
  await testMergePreservesOtherFields();
  console.log('All notificationPreferencesRepository tests passed');
}

run();
