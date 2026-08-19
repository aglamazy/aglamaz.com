import assert from 'node:assert/strict';

// BlogPostBody is 'use client' but Next.js server-renders it on first paint anyway - a
// real live bug (Agla, 2026-08-12) traced to plain `dompurify`'s default export requiring
// a real `window`, which doesn't exist under plain Node/SSR. BlogPostBody's own try/catch
// silently swallowed the resulting throw and fell back to raw, unparsed markdown - every
// page using it (blog list, blog detail, the review page, new-post preview) was affected.
// This proves the actual runtime behavior in a plain Node context (no jsdom, no browser),
// the same environment Next.js SSR runs in - not just that the import resolves.

async function testPlainDompurifyIsBrokenUnderPlainNode() {
  // Documents WHY the fix is needed, not a thing to "fix" here - plain dompurify's default
  // export is not a ready-to-use sanitizer outside a browser; this must stay broken in this
  // environment or the isomorphic-dompurify swap below has nothing to prove.
  const DOMPurify = (await import('dompurify')).default;
  assert.notEqual(
    typeof (DOMPurify as any).sanitize,
    'function',
    'plain dompurify.sanitize must NOT be a callable function under plain Node - if this now passes, dompurify itself changed its Node behavior and BlogPostBody could safely revert off isomorphic-dompurify',
  );
  console.log('plain dompurify.sanitize is confirmed non-callable under plain Node (documents the bug this fix addresses): PASSED');
}

async function testIsomorphicDompurifyWorksUnderPlainNode() {
  const DOMPurify = (await import('isomorphic-dompurify')).default;
  const result = DOMPurify.sanitize('<p>hello <em>world</em></p><script>alert(1)</script>');
  assert.equal(result, '<p>hello <em>world</em></p>', 'isomorphic-dompurify must sanitize AND strip dangerous tags under plain Node (the SSR environment)');
  console.log('isomorphic-dompurify sanitizes correctly under plain Node (the fix actually works in the SSR environment): PASSED');
}

async function run() {
  await testPlainDompurifyIsBrokenUnderPlainNode();
  await testIsomorphicDompurifyWorksUnderPlainNode();
}

run();
