'use client';

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Renders blog-post content. Branches on `format`:
//   - 'md'                → run through marked (GFM) + DOMPurify, then dangerouslySetInnerHTML
//   - 'html' or undefined → dangerouslySetInnerHTML as before (back-compat for posts
//                            written before contentFormat was tracked)
//
// The format is per-post (not per-locale) — translations of a md post stay md
// because the GPT translation prompt is told to preserve markdown structure
// (see TranslationService.translateText system prompt).
//
// isomorphic-dompurify, NOT plain dompurify (Agla, 2026-08-12, live): this component is
// 'use client' but Next.js still server-renders it on first paint - plain dompurify's
// default export needs a real `window` and is not even a function under Node, so every
// SSR pass threw inside the try/catch below and silently fell back to raw, unparsed
// markdown. Every page using this component (blog list, blog detail, the review page,
// new-post preview) was affected - this was never actually proven working, despite
// looking fine in whatever manual checks happened before. Confirmed the failure directly:
// `node -e "require('dompurify').sanitize(...)"` throws "sanitize is not a function".
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
      return DOMPurify.sanitize(raw);
    } catch {
      return content || '';
    }
  }, [content, format]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
