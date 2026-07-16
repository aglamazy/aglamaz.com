// Syncs FamCircle members' magazine opt-out preference to the fleet Listmonk
// instance that sends the monthly email magazine campaign (see infra.json
// "listmonk" entry — owner: Ant, host ub04, lists.aglamaz.com).
//
// Gated on LISTMONK_API_URL / LISTMONK_API_TOKEN / LISTMONK_MAGAZINE_LIST_ID.
// No-ops (logs + returns false) when any is missing — mirrors
// ResendService.isEnabled(), so local dev and not-yet-onboarded sites don't
// need a live Listmonk credential to run.

export type ListmonkSubscriptionStatus = 'unconfirmed' | 'confirmed' | 'unsubscribed';

interface ListmonkSubscriber {
  id: number;
  email: string;
}

export class ListmonkService {
  static isEnabled(): boolean {
    return !!(
      process.env.LISTMONK_API_URL &&
      process.env.LISTMONK_API_TOKEN &&
      process.env.LISTMONK_MAGAZINE_LIST_ID
    );
  }

  private static authHeader(): string {
    return `token ${process.env.LISTMONK_API_TOKEN}`;
  }

  private static apiUrl(path: string): string {
    const base = process.env.LISTMONK_API_URL!.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  private static async findSubscriberByEmail(email: string): Promise<ListmonkSubscriber | null> {
    const escaped = email.replace(/'/g, "''");
    const query = encodeURIComponent(`subscribers.email='${escaped}'`);
    const response = await fetch(ListmonkService.apiUrl(`/api/subscribers?query=${query}`), {
      headers: { Authorization: ListmonkService.authHeader() },
    });
    if (!response.ok) {
      throw new Error(`[ListmonkService] subscriber lookup failed ${response.status}: ${await response.text()}`);
    }
    const body = await response.json();
    const results = body?.data?.results ?? [];
    return results[0] ?? null;
  }

  /**
   * Subscribes or unsubscribes a member's email from the site's magazine
   * list. Returns true once the request reached Listmonk, false if the
   * integration is not configured for this deployment (soft no-op).
   */
  static async syncMagazineOptOut(email: string, optOut: boolean): Promise<boolean> {
    if (!ListmonkService.isEnabled()) {
      console.log('[ListmonkService] LISTMONK_* env vars not configured — skipping magazine sync for', email);
      return false;
    }

    const listId = Number(process.env.LISTMONK_MAGAZINE_LIST_ID);
    const existing = await ListmonkService.findSubscriberByEmail(email);

    if (!existing) {
      if (optOut) {
        // Never subscribed — nothing to unsubscribe.
        return true;
      }
      const response = await fetch(ListmonkService.apiUrl('/api/subscribers'), {
        method: 'POST',
        headers: {
          Authorization: ListmonkService.authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name: email,
          status: 'enabled',
          lists: [listId],
          preconfirm_subscriptions: true,
        }),
      });
      if (!response.ok) {
        throw new Error(`[ListmonkService] create subscriber failed ${response.status}: ${await response.text()}`);
      }
      return true;
    }

    const status: ListmonkSubscriptionStatus = optOut ? 'unsubscribed' : 'unconfirmed';
    const response = await fetch(ListmonkService.apiUrl('/api/subscribers/lists'), {
      method: 'PUT',
      headers: {
        Authorization: ListmonkService.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: [existing.id],
        action: 'add',
        target_list_ids: [listId],
        status,
      }),
    });
    if (!response.ok) {
      throw new Error(`[ListmonkService] update subscriber list status failed ${response.status}: ${await response.text()}`);
    }
    return true;
  }
}
