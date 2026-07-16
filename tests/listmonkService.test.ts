import assert from 'node:assert/strict';

async function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    original[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    await fn();
  } finally {
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

async function testNotConfiguredNoOps() {
  await withEnv(
    { LISTMONK_API_URL: undefined, LISTMONK_API_TOKEN: undefined, LISTMONK_MAGAZINE_LIST_ID: undefined },
    async () => {
      const { ListmonkService } = await import('../src/services/ListmonkService');
      assert.equal(ListmonkService.isEnabled(), false);
      const synced = await ListmonkService.syncMagazineOptOut('a@example.com', true);
      assert.equal(synced, false, 'should no-op (not throw) when unconfigured');
    }
  );
  console.log('listmonk not-configured no-op test passed');
}

async function testCreatesSubscriberWhenOptingIn() {
  await withEnv(
    {
      LISTMONK_API_URL: 'https://lists.example.com',
      LISTMONK_API_TOKEN: 'user:token',
      LISTMONK_MAGAZINE_LIST_ID: '5',
    },
    async () => {
      const { ListmonkService } = await import('../src/services/ListmonkService');
      const originalFetch = global.fetch;
      const calls: { url: string; init?: RequestInit }[] = [];

      global.fetch = (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes('/api/subscribers?query=')) {
          return { ok: true, json: async () => ({ data: { results: [] } }) } as Response;
        }
        if (url.endsWith('/api/subscribers') && init?.method === 'POST') {
          const body = JSON.parse(init!.body as string);
          assert.equal(body.email, 'new@example.com');
          assert.deepEqual(body.lists, [5]);
          return { ok: true, json: async () => ({}) } as Response;
        }
        throw new Error(`unexpected fetch call: ${url}`);
      }) as typeof fetch;

      try {
        const synced = await ListmonkService.syncMagazineOptOut('new@example.com', false);
        assert.equal(synced, true);
        assert.equal(calls.length, 2, 'should look up then create');
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
  console.log('listmonk create-subscriber test passed');
}

async function testUnsubscribesExistingSubscriber() {
  await withEnv(
    {
      LISTMONK_API_URL: 'https://lists.example.com',
      LISTMONK_API_TOKEN: 'user:token',
      LISTMONK_MAGAZINE_LIST_ID: '5',
    },
    async () => {
      const { ListmonkService } = await import('../src/services/ListmonkService');
      const originalFetch = global.fetch;
      const calls: { url: string; init?: RequestInit }[] = [];

      global.fetch = (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes('/api/subscribers?query=')) {
          return { ok: true, json: async () => ({ data: { results: [{ id: 42, email: 'existing@example.com' }] } }) } as Response;
        }
        if (url.endsWith('/api/subscribers/lists') && init?.method === 'PUT') {
          const body = JSON.parse(init!.body as string);
          assert.deepEqual(body.ids, [42]);
          assert.equal(body.status, 'unsubscribed');
          return { ok: true, json: async () => ({}) } as Response;
        }
        throw new Error(`unexpected fetch call: ${url}`);
      }) as typeof fetch;

      try {
        const synced = await ListmonkService.syncMagazineOptOut('existing@example.com', true);
        assert.equal(synced, true);
        assert.equal(calls.length, 2, 'should look up then update list status');
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
  console.log('listmonk unsubscribe-existing test passed');
}

async function run() {
  await testNotConfiguredNoOps();
  await testCreatesSubscriberWhenOptingIn();
  await testUnsubscribesExistingSubscriber();
}

run();
