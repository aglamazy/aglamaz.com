export function normalizeSlug(input: string, fallback = 'user'): string {
  const sanitized = (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || fallback;
}

export function suggestSlugFromParts(...parts: Array<string | null | undefined>): string {
  const raw = parts
    .map(part => part?.trim().toLowerCase() || '')
    .filter(Boolean)
    .join('-');
  return normalizeSlug(raw);
}
