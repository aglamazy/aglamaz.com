/**
 * Which image indexes have already been asked for likes, per item (famcircle#199).
 *
 * Option (a) asks only for the photos on screen and extends the ask as the viewer
 * scrolls. Scrolling back up, or a re-render of the same tiles, must cost no new reads:
 * `take` hands back only indexes never asked before and marks them asked. A failed
 * request `release`s its indexes so the next time they come on screen they are retried.
 */
export class LikeRequestTracker {
  private readonly asked = new Map<string, Set<number>>();

  take(id: string, indexes: Iterable<number>): number[] {
    let set = this.asked.get(id);
    if (!set) {
      set = new Set();
      this.asked.set(id, set);
    }
    const fresh: number[] = [];
    for (const idx of indexes) {
      if (set.has(idx)) continue;
      set.add(idx);
      fresh.push(idx);
    }
    return fresh.sort((a, b) => a - b);
  }

  release(id: string, indexes: Iterable<number>): void {
    const set = this.asked.get(id);
    if (!set) return;
    for (const idx of indexes) set.delete(idx);
  }

  /** Forget everything, so a reloaded feed asks again for what it shows. */
  reset(): void {
    this.asked.clear();
  }

  /** Total indexes asked so far across every item - the like reads issued. */
  get askedCount(): number {
    let n = 0;
    for (const set of this.asked.values()) n += set.size;
    return n;
  }
}
