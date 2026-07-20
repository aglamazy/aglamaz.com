import assert from 'node:assert/strict';
import { BlessingRepository } from '../src/repositories/BlessingRepository';

// Minimal in-memory fake standing in for FirebaseFirestore.Firestore, covering
// only the collection().add()/.doc()/.where().orderBy().get() surface the
// repository uses. There's no Firestore emulator available in this
// environment (needs a JVM), so this fake is what makes the round-trip test
// runnable here.
function makeFakeFirestore() {
  const store = new Map<string, Record<string, unknown>>();
  let nextId = 1;

  function matches(data: Record<string, unknown>, filters: Array<[string, unknown]>) {
    return filters.every(([field, value]) => data[field] === value);
  }

  function makeQuery(name: string, filters: Array<[string, unknown]>) {
    return {
      where(field: string, _op: string, value: unknown) {
        return makeQuery(name, [...filters, [field, value]]);
      },
      orderBy() {
        return this;
      },
      async get() {
        const docs = Array.from(store.entries())
          .filter(([key]) => key.startsWith(`${name}/`))
          .filter(([, data]) => matches(data, filters))
          .map(([key, data]) => ({
            id: key.slice(name.length + 1),
            data: () => data,
          }));
        return { docs };
      },
    };
  }

  return {
    collection(name: string) {
      return {
        ...makeQuery(name, []),
        doc(id: string) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const data = store.get(key);
              return { exists: data !== undefined, id, data: () => data };
            },
            async update(updates: Record<string, unknown>) {
              const existing = store.get(key) || {};
              store.set(key, { ...existing, ...updates });
            },
            async delete() {
              store.delete(key);
            },
          };
        },
        async add(data: Record<string, unknown>) {
          const id = `doc${nextId++}`;
          const key = `${name}/${id}`;
          store.set(key, data);
          return {
            id,
            async get() {
              return { exists: true, id, data: () => store.get(key) };
            },
          };
        },
      };
    },
  };
}

async function testCreateDefaultsToPrivate() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new BlessingRepository(fakeDb);

  const blessing = await repo.create({
    blessingPageId: 'page1',
    siteId: 'site1',
    authorId: 'author1',
    authorName: 'Author One',
    content: 'A private memory',
    locale: 'en',
  });

  assert.equal(blessing.visibleToPublic, false);
  console.log('blessing create defaults to private test passed');
}

async function testPublicListingNeverLeaksNonPublicBlessings() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new BlessingRepository(fakeDb);

  await repo.create({
    blessingPageId: 'page1', siteId: 'site1', authorId: 'a1', authorName: 'A',
    content: 'private memory', locale: 'en', visibleToPublic: false,
  });
  const publicOne = await repo.create({
    blessingPageId: 'page1', siteId: 'site1', authorId: 'a2', authorName: 'B',
    content: 'public memory', locale: 'en', visibleToPublic: true,
  });
  const publicButDeleted = await repo.create({
    blessingPageId: 'page1', siteId: 'site1', authorId: 'a3', authorName: 'C',
    content: 'public but deleted', locale: 'en', visibleToPublic: true,
  });
  await repo.softDelete(publicButDeleted.id);

  const publicBlessings = await repo.listPublicByBlessingPage('page1');

  assert.equal(publicBlessings.length, 1);
  assert.equal(publicBlessings[0].id, publicOne.id);
  assert.ok(publicBlessings.every((b) => b.visibleToPublic === true));
  assert.ok(publicBlessings.every((b) => b.deleted === false));

  // The private (member-facing) listing still returns everything not deleted.
  const allBlessings = await repo.listByBlessingPage('page1');
  assert.equal(allBlessings.length, 2);

  console.log('public blessing listing never leaks private/deleted blessings test passed');
}

async function testUpdateCanToggleVisibility() {
  const fakeDb = makeFakeFirestore() as unknown as FirebaseFirestore.Firestore;
  const repo = new BlessingRepository(fakeDb);

  const blessing = await repo.create({
    blessingPageId: 'page1', siteId: 'site1', authorId: 'a1', authorName: 'A',
    content: 'memory', locale: 'en',
  });
  assert.equal(blessing.visibleToPublic, false);

  await repo.update(blessing.id, { content: 'memory', locale: 'en', visibleToPublic: true });
  const [afterToggleOn] = await repo.listPublicByBlessingPage('page1');
  assert.equal(afterToggleOn.id, blessing.id);

  await repo.update(blessing.id, { content: 'memory', locale: 'en', visibleToPublic: false });
  const afterToggleOff = await repo.listPublicByBlessingPage('page1');
  assert.equal(afterToggleOff.length, 0);

  console.log('blessing update toggles public visibility test passed');
}

async function run() {
  await testCreateDefaultsToPrivate();
  await testPublicListingNeverLeaksNonPublicBlessings();
  await testUpdateCanToggleVisibility();
}

run();
