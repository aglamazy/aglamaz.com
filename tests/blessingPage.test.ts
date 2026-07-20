import assert from 'node:assert/strict';
import { BlessingPageRepository } from '../src/repositories/BlessingPageRepository';

// ---------------------------------------------------------------------------
// Minimal in-memory Firestore mock — just enough surface area for the repo
// ---------------------------------------------------------------------------

type DocData = Record<string, any>;

class MockWhereChain {
  constructor(
    private docs: Map<string, DocData>,
    private filters: Array<{ field: string; op: string; value: any }>
  ) {}

  where(field: string, op: string, value: any): MockWhereChain {
    return new MockWhereChain(this.docs, [...this.filters, { field, op, value }]);
  }

  limit(n: number) {
    return { get: () => this._query(n) };
  }

  get() {
    return this._query(Infinity);
  }

  private async _query(maxResults: number) {
    const entries = Array.from(this.docs.entries());
    const matching = entries.filter(([, data]) =>
      this.filters.every(({ field, op, value }) => {
        if (op === '==') return data[field] === value;
        return false;
      })
    );
    const limited = matching.slice(0, maxResults === Infinity ? matching.length : maxResults);
    return {
      empty: limited.length === 0,
      docs: limited.map(([id, data]) => ({ id, data: () => ({ ...data }) })),
    };
  }
}

class MockCollection {
  readonly docs: Map<string, DocData> = new Map();
  private counter = 0;

  add(data: DocData) {
    const id = `doc${++this.counter}`;
    this.docs.set(id, { ...data });
    const id_ = id;
    const docs_ = this.docs;
    return Promise.resolve({
      id,
      get() {
        return Promise.resolve({ id: id_, exists: true, data: () => ({ ...docs_.get(id_) }) });
      },
    });
  }

  doc(id: string) {
    return {
      get: () => {
        const data = this.docs.get(id);
        return Promise.resolve({ id, exists: !!data, data: () => ({ ...(data ?? {}) }) });
      },
      delete: () => { this.docs.delete(id); return Promise.resolve(); },
    };
  }

  where(field: string, op: string, value: any): MockWhereChain {
    return new MockWhereChain(this.docs, [{ field, op, value }]);
  }
}

function makeMockDb() {
  const col = new MockCollection();
  return {
    col,
    db: {
      collection: (_name: string) => col,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testStandingPageIdempotency() {
  // A death-event's page is created once and reused every subsequent call.
  // Simulates: "create memory in year N, look up page in year N+1 → same page".
  const { db } = makeMockDb();
  const repo = new BlessingPageRepository(db);

  const firstPage = await repo.createStanding({
    eventId: 'evt-death-1',
    siteId: 'site1',
    createdBy: 'user1',
  });

  // Second call (simulates year N+1): must return the same page
  const secondPage = await repo.createStanding({
    eventId: 'evt-death-1',
    siteId: 'site1',
    createdBy: 'user2',
  });

  assert.equal(firstPage.id, secondPage.id, 'standing page must be the same across multiple createStanding calls');
  assert.equal(firstPage.slug, 'evt-death-1', 'standing page slug must be the eventId (no year suffix)');
  assert.equal(firstPage.pageType, 'standing');
  assert.equal(firstPage.year, undefined, 'standing page must have no year field');

  console.log('standing page idempotency test passed');
}

async function testGetByEventStandingFindsExistingPage() {
  const { db } = makeMockDb();
  const repo = new BlessingPageRepository(db);

  const created = await repo.createStanding({
    eventId: 'evt-death-2',
    siteId: 'site1',
    createdBy: 'user1',
  });

  const found = await repo.getByEventStanding('evt-death-2');
  assert.ok(found, 'getByEventStanding must return the page');
  assert.equal(found!.id, created.id);

  const notFound = await repo.getByEventStanding('evt-death-999');
  assert.equal(notFound, null, 'getByEventStanding must return null for unknown event');

  console.log('getByEventStanding test passed');
}

async function testAnnualPagesAreUnaffected() {
  // Non-death events still get separate pages per year.
  const { db } = makeMockDb();
  const repo = new BlessingPageRepository(db);

  const page2025 = await repo.create({ eventId: 'evt-bday-1', siteId: 'site1', year: 2025, createdBy: 'u1' });
  const page2026 = await repo.create({ eventId: 'evt-bday-1', siteId: 'site1', year: 2026, createdBy: 'u1' });

  assert.notEqual(page2025.id, page2026.id, 'annual pages for different years must be distinct');
  assert.equal(page2025.year, 2025);
  assert.equal(page2026.year, 2026);
  assert.equal(page2025.slug, 'evt-bday-1-2025');
  assert.equal(page2026.slug, 'evt-bday-1-2026');

  // Idempotent within a year
  const page2025Again = await repo.create({ eventId: 'evt-bday-1', siteId: 'site1', year: 2025, createdBy: 'u2' });
  assert.equal(page2025Again.id, page2025.id, 'create for same event+year must return the existing page');

  console.log('annual pages unaffected test passed');
}

async function testListByEventIncludesStandingPage() {
  const { db } = makeMockDb();
  const repo = new BlessingPageRepository(db);

  const annual = await repo.create({ eventId: 'evt-death-3', siteId: 'site1', year: 2024, createdBy: 'u1' });
  const standing = await repo.createStanding({ eventId: 'evt-death-3', siteId: 'site1', createdBy: 'u1' });

  const pages = await repo.listByEvent('evt-death-3');
  assert.equal(pages.length, 2);
  // Standing page should appear first
  assert.equal(pages[0].id, standing.id, 'standing page must sort before annual pages in listByEvent');
  assert.equal(pages[1].id, annual.id);

  console.log('listByEvent includes standing page test passed');
}

async function run() {
  await testStandingPageIdempotency();
  await testGetByEventStandingFindsExistingPage();
  await testAnnualPagesAreUnaffected();
  await testListByEventIncludesStandingPage();
  console.log('All blessing page tests passed');
}

run();
