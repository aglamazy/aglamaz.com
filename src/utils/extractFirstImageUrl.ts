// Matches whichever image syntax (HTML <img> or Markdown ![]()) occurs earliest in the
// content, since a post's contentFormat only says which one the editor authored - either
// can end up embedded in the raw string.
const FIRST_IMAGE_RE = /<img[^>]*\ssrc=["']([^"']+)["']|!\[[^\]]*\]\(([^)\s]+)\)/i;

/** First image URL found in post content (HTML or Markdown), or undefined when none is present. */
export function extractFirstImageUrl(content: string | undefined | null): string | undefined {
  if (!content) return undefined;
  const match = content.match(FIRST_IMAGE_RE);
  if (!match) return undefined;
  return match[1] || match[2];
}
