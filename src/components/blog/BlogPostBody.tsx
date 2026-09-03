'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Renders blog-post content. Branches on `format`:
//   - 'md'                → run through marked (GFM) + sanitize-html, then dangerouslySetInnerHTML
//   - 'html' or undefined → dangerouslySetInnerHTML as before (back-compat for posts
//                            written before contentFormat was tracked)
//
// The format is per-post (not per-locale) — translations of a md post stay md
// because the GPT translation prompt is told to preserve markdown structure
// (see TranslationService.translateText system prompt).
//
// sanitize-html, NOT DOMPurify (Agla/Buddy, 2026-09-03, live — famcircle#170): this
// component is 'use client' but Next.js still server-renders it on first paint, so the
// sanitizer must run isomorphically. isomorphic-dompurify solved that by shimming a DOM
// via jsdom on the server, but jsdom's own core HTML parser (parse5) is ESM-only with no
// CJS-only version in its history, and Vercel's production Node runtime does not support
// require(esm) for it — every SSR pass of a real blog page threw ERR_REQUIRE_ESM,
// producing a hard PROD 500 on every /blog route, in every locale, regardless of bundler
// (confirmed under both Turbopack and webpack). sanitize-html uses htmlparser2 (pure JS,
// no DOM shim, no ESM sub-dependencies) so it has no equivalent failure mode. See
// docs/turbopack-jsdom-esm-interop.md for the full incident writeup.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    code: ['class'],
    pre: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export default function BlogPostBody({
  content,
  format,
  className,
}: {
  content: string;
  format?: 'md' | 'html';
  className?: string;
}) {
  const html = useMemo(() => {
    if (format !== 'md') return content || '';
    try {
      const raw = marked.parse(content || '', { async: false, gfm: true, breaks: false }) as string;
      return sanitizeHtml(raw, SANITIZE_OPTIONS);
    } catch {
      return content || '';
    }
  }, [content, format]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
