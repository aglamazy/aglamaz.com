#!/usr/bin/env tsx
/**
 * One-way PUSH sync: FamCircle's own blog subscribers (BlogSubscriberRepository, collected
 * via the site's own subscribe box) -> a dedicated Listmonk list. Built for Shofar's
 * scout#169 (blog-post email campaigns) per Buddy's push-model ruling (2026-08-03): Shofar
 * triggers campaigns against a list ID, it never receives, stores, or transits a single
 * subscriber email - this script is the only thing that ever reads real addresses, and it
 * only ever sends them to Listmonk, never logs them.
 *
 * Runs on ub04 (systemd timer, see ops/systemd/listmonk-sync.{service,timer}) because
 * Listmonk binds 127.0.0.1:9000 there by design and is not publicly reachable - LISTMONK_API_URL
 * only makes sense from that host's own vantage point. Do NOT "fix" it to a public hostname.
 *
 * Credentials (LISTMONK_API_URL/LISTMONK_API_USER/LISTMONK_API_TOKEN) are delivered by Buddy
 * server-side into /etc/famcircle-listmonk-sync.env on ub04 (root:fcsync, mode 640) - this
 * script only ever reads them from process.env, no literal fallback on any of them.
 *
 * Idempotency (the condition that matters most, per Buddy's approval): re-running must NEVER
 * resurrect a subscriber who unsubscribed in Listmonk. Every email is looked up first; a
 * subscriber already on the target list with subscription_status 'unsubscribed' is left alone.
 * Only subscribers who were never added to the list (or don't exist in Listmonk at all yet)
 * get added.
 *
 * Logging: counts only (added/updated/skipped/failed) - never subscriber emails. A log file is
 * another copy of the PII this whole design was built to minimise.
 *
 * Fails loud: any missing env var, any Listmonk auth/network failure, exits non-zero.
 *
 * Usage: npx tsx scripts/sync-listmonk-subscribers.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { initAdmin } from '../src/firebase/admin';
import { BlogSubscriberRepository } from '../src/repositories/BlogSubscriberRepository';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

interface ListmonkListEntry {
  id: number;
  subscription_status: 'unconfirmed' | 'confirmed' | 'unsubscribed';
}

interface ListmonkSubscriber {
  id: number;
  email: string;
  lists?: ListmonkListEntry[];
}

class ListmonkClient {
  constructor(
    private readonly baseUrl: string,
    private readonly authHeader: string,
  ) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Listmonk ${init.method || 'GET'} ${path} failed: ${res.status} ${body.slice(0, 200)}`);
    }
    return res;
  }

  async findByEmail(email: string): Promise<ListmonkSubscriber | null> {
    const escaped = email.replace(/'/g, "''");
    const query = encodeURIComponent(`subscribers.email='${escaped}'`);
    const res = await this.request(`/api/subscribers?query=${query}`);
    const json = await res.json();
    const results = json?.data?.results;
    if (!Array.isArray(results) || results.length === 0) return null;
    return results[0] as ListmonkSubscriber;
  }

  async create(email: string, listId: number): Promise<void> {
    await this.request('/api/subscribers', {
      method: 'POST',
      body: JSON.stringify({
        email,
        status: 'enabled',
        lists: [listId],
        preconfirm_subscriptions: true,
      }),
    });
  }

  async addToList(subscriberId: number, listId: number): Promise<void> {
    await this.request(`/api/subscribers/${subscriberId}/lists`, {
      method: 'PUT',
      body: JSON.stringify({
        ids: [listId],
        action: 'add',
        status: 'unconfirmed',
      }),
    });
  }
}

async function main() {
  const apiUrl = requireEnv('LISTMONK_API_URL').replace(/\/+$/, '');
  const apiUser = requireEnv('LISTMONK_API_USER');
  const apiToken = requireEnv('LISTMONK_API_TOKEN');
  const siteId = requireEnv('LISTMONK_SYNC_SITE_ID');
  const listId = parseInt(requireEnv('LISTMONK_SYNC_LIST_ID'), 10);
  if (!Number.isFinite(listId)) {
    throw new Error('LISTMONK_SYNC_LIST_ID must be a number');
  }

  const client = new ListmonkClient(apiUrl, `token ${apiUser}:${apiToken}`);

  initAdmin();
  const subscribers = await new BlogSubscriberRepository().getBySite(siteId);

  let added = 0;
  let alreadyOnList = 0;
  let skippedUnsubscribed = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    try {
      const existing = await client.findByEmail(subscriber.email);
      if (!existing) {
        await client.create(subscriber.email, listId);
        added++;
        continue;
      }

      const membership = existing.lists?.find((l) => l.id === listId);
      if (!membership) {
        await client.addToList(existing.id, listId);
        added++;
      } else if (membership.subscription_status === 'unsubscribed') {
        skippedUnsubscribed++;
      } else {
        alreadyOnList++;
      }
    } catch (err) {
      failed++;
      console.error(`[listmonk-sync] failed for one subscriber:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `[listmonk-sync] total=${subscribers.length} added=${added} already_on_list=${alreadyOnList} ` +
    `skipped_unsubscribed=${skippedUnsubscribed} failed=${failed}`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[listmonk-sync] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
