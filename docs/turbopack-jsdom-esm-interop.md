# Turbopack's SSR external-loader doesn't replicate Node's require(esm) interop

**Found:** 2026-09-02/03, famcircle#170 (live PROD 500 on `/blog`, all locales, 2+ days).
**Scope:** Next.js 16.0.10 building with Turbopack (the current default for `next
build` with no flag). Confirmed via repeated live reproduction against Vercel's
actual runtime — not a local-only artifact.

## The mechanism, in one sentence

When a CommonJS package's own internal code does `require()` of one of its own
ESM-only sub-dependencies (the pattern Node 20.19+/22.12+ natively supports via
`require(esm)`), Turbopack's SSR bundler — even when that top-level package is marked
`serverExternalPackages` — routes the *inner* require through its own
`externalRequire`/`externalImport` wrapper functions
(`.next/server/chunks/ssr/[turbopack]_runtime.js`), and that wrapper does not
correctly replicate Node's native interop. The result is
`Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported`, thrown at
request time, in production, regardless of what the top-level package name is.

**`serverExternalPackages` does mark the named package external — that part works**
(confirmed: the error text always correctly names the package Next thinks it
externalized). The bug is one level down: Turbopack's own loader for content *inside*
an externalized package doesn't hand off to Node's real `require`.

## Why this surfaced as three separate-looking bugs in one night

jsdom (pulled in transitively by `isomorphic-dompurify`, used for server-side blog
HTML sanitization) has been progressively modernizing its own dependency tree to
ESM-only sub-packages, at multiple points in the tree:

1. `html-encoding-sniffer@^6` → `@exodus/bytes` (ESM-only)
2. `cssstyle@^4.2.0+` → `@asamuzakjp/css-color` → `@csstools/css-calc` (ESM-only)
3. jsdom's own core HTML parser dependency, `parse5` — ESM-only since at least
   `parse5@7.0.0`, confirmed present in every jsdom major back to at least jsdom 20.

Pinning around (1) and (2) via `package.json`'s `overrides` (forcing older,
pre-ESM-adoption versions of `html-encoding-sniffer`/`cssstyle`) is a real, valid
workaround **for those two specific dependencies** — see the commits on
famcircle main (`5399b23`, `27be061`, `7564819`). It does not work for (3): parse5 is
core, unavoidable jsdom functionality with no CJS-only version in recent history to
pin to. **There is no version-pinning escape route past parse5** — confirmed by
checking jsdom major versions back to 20.x, all of which already depend on ESM-only
parse5.

## The actual fix

Build with webpack instead of Turbopack (`next build --webpack`). Confirmed: webpack
compiles this exact dependency tree with zero ESM-interop errors — Node's native
`require(esm)` support works correctly under webpack's own external-module handling.
See `docs/webpack-switch-regression-list.md` for the switch's own regression list —
not done same-night as this finding because switching production bundlers is a
whole-app-blast-radius change that itself surfaced two *unrelated* pre-existing bugs
Turbopack was silently letting through (see that doc), and neither should be shipped
as a rushed midnight deploy with nobody watching.

## Why this will bite another repo

Any Next.js 16 project using Turbopack (the new default) that depends — even
transitively — on a CommonJS package whose own dependency tree includes an ESM-only
module will hit this. jsdom is one example; it is very likely not the only widely-used
package with this shape, given the broader ecosystem's ongoing ESM migration. The
diagnostic signature to watch for: `ERR_REQUIRE_ESM` thrown from inside
`.next/server/chunks/ssr/[turbopack]_runtime.js`'s `externalRequire`/`externalImport`,
naming a file path under a package that *was* correctly listed in
`serverExternalPackages` — that combination means this bug, not a config mistake.
