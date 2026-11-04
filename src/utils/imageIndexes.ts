/**
 * Image indexes a client asks likes for (famcircle#199, option a: only the photos on
 * screen). Every like read is one Firestore collection get per index, so the set the
 * client names IS the read count - nothing here widens it.
 */

/** Largest number of indexes one request may name; a screen never holds more. */
export const MAX_LIKE_INDEXES_PER_REQUEST = 500;

export type ParsedIndexes = { ok: true; indexes: number[] } | { ok: false; error: string };

function validate(values: unknown[]): ParsedIndexes {
  if (values.length === 0) {
    return { ok: false, error: 'indexes must name at least one image' };
  }
  const seen = new Set<number>();
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      return { ok: false, error: `invalid image index: ${JSON.stringify(v)}` };
    }
    seen.add(v);
  }
  if (seen.size > MAX_LIKE_INDEXES_PER_REQUEST) {
    return { ok: false, error: `at most ${MAX_LIKE_INDEXES_PER_REQUEST} indexes per request` };
  }
  return { ok: true, indexes: Array.from(seen).sort((a, b) => a - b) };
}

/** From a JSON body field: must be an array of non-negative integers. Duplicates collapse. */
export function parseIndexArray(raw: unknown): ParsedIndexes {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'indexes must be an array' };
  }
  return validate(raw);
}

/** From a query string value: comma-separated non-negative integers, e.g. "60,61,62". */
export function parseIndexList(raw: string): ParsedIndexes {
  const parts = raw.split(',').map((p) => p.trim());
  const values: unknown[] = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : p));
  return validate(values);
}
