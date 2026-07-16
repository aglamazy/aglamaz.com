/**
 * Thin client for the Listmonk mailing-list API.
 *
 * Required env vars (all must be set — no fallbacks):
 *   LISTMONK_API_URL             e.g. https://listmonk.example.com
 *   LISTMONK_USERNAME            admin username
 *   LISTMONK_PASSWORD            admin password
 *   LISTMONK_MAGAZINE_LIST_ID    integer list ID for the monthly magazine
 *
 * Syncs a single subscriber's subscription status for the magazine list.
 * Called from the notification-preferences API route after persisting to Firestore.
 * Failure is non-fatal: the route logs the error and returns 200.
 */
export class ListmonkService {
  private readonly apiUrl: string;
  private readonly listId: number;
  private readonly authHeader: string;

  constructor() {
    if (!process.env.LISTMONK_API_URL) {
      throw new Error('LISTMONK_API_URL env var is required');
    }
    if (!process.env.LISTMONK_USERNAME) {
      throw new Error('LISTMONK_USERNAME env var is required');
    }
    if (!process.env.LISTMONK_PASSWORD) {
      throw new Error('LISTMONK_PASSWORD env var is required');
    }
    if (!process.env.LISTMONK_MAGAZINE_LIST_ID) {
      throw new Error('LISTMONK_MAGAZINE_LIST_ID env var is required');
    }

    this.apiUrl = process.env.LISTMONK_API_URL.replace(/\/$/, '');
    this.listId = parseInt(process.env.LISTMONK_MAGAZINE_LIST_ID, 10);
    this.authHeader = `Basic ${Buffer.from(
      `${process.env.LISTMONK_USERNAME}:${process.env.LISTMONK_PASSWORD}`
    ).toString('base64')}`;
  }

  private async findSubscriberIdByEmail(email: string): Promise<number | null> {
    const query = encodeURIComponent(`subscribers.email = '${email.replace(/'/g, "''")}'`);
    const res = await fetch(`${this.apiUrl}/api/subscribers?query=${query}&page=1&per_page=1`, {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const results = body?.data?.results;
    if (!Array.isArray(results) || results.length === 0) return null;
    return (results[0].id as number) ?? null;
  }

  async unsubscribeFromMagazine(email: string): Promise<void> {
    const id = await this.findSubscriberIdByEmail(email);
    if (!id) return;
    const res = await fetch(`${this.apiUrl}/api/subscribers/lists`, {
      method: 'PUT',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id], action: 'unsubscribe', target_list_ids: [this.listId] }),
    });
    if (!res.ok) {
      throw new Error(`Listmonk unsubscribe failed: ${res.status}`);
    }
  }

  async subscribeToMagazine(email: string, name: string): Promise<void> {
    const id = await this.findSubscriberIdByEmail(email);
    if (!id) {
      const res = await fetch(`${this.apiUrl}/api/subscribers`, {
        method: 'POST',
        headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          lists: [this.listId],
          status: 'enabled',
          preconfirm_subscriptions: true,
        }),
      });
      if (!res.ok) {
        throw new Error(`Listmonk create subscriber failed: ${res.status}`);
      }
      return;
    }
    const res = await fetch(`${this.apiUrl}/api/subscribers/lists`, {
      method: 'PUT',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [id],
        action: 'add',
        status: 'confirmed',
        target_list_ids: [this.listId],
      }),
    });
    if (!res.ok) {
      throw new Error(`Listmonk re-subscribe failed: ${res.status}`);
    }
  }
}
