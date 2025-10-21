export const stripScriptTags = (value: string) => value.replace(/<\/(script)/gi, '</$1').replace(/</g, '\\u003C');

export function cleanJsonLd(value: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    if (Array.isArray(entry)) {
      const filtered = entry.filter((item) => item !== undefined && item !== null && item !== '');
      if (filtered.length > 0) {
        clean[key] = filtered.map((item) => (typeof item === 'object' && item !== null ? cleanJsonLd(item as Record<string, unknown>) : item));
      }
      continue;
    }
    if (typeof entry === 'object' && !(entry instanceof Date)) {
      const nested = cleanJsonLd(entry as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        clean[key] = nested;
      }
      continue;
    }
    clean[key] = entry;
  }
  return clean;
}
