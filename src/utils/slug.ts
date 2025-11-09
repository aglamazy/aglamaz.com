export function normalizeSlug(input: string, fallback = 'user'): string {
  const sanitized = (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || fallback;
}
