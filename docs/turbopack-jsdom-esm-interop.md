# jsdom's ESM-only parse5 breaks under Vercel's Node runtime (not a Turbopack bug)

**Found:** 2026-09-02, famcircle#170 (live PROD 500 on `/blog`, all locales, 2+ days).
**CORRECTED:** 2026-09-03. The original version of this doc attributed the failure to
Turbopack's SSR bundler specifically. That attribution was wrong: after switching the
production build from Turbopack to webpack, the identical `ERR_REQUIRE_ESM` error still
occurred, with a stack trace pointing into Vercel's own serverless runtime layer
(`/opt/rust/nodejs.js`), not any bundler-generated file. **The real constraint is
Vercel's production Node.js execution environment, independent of bundler choice.**

## The mechanism, corrected

`isomorphic-dompurify` shims a DOM on the server via `jsdom` so the same sanitizer code
works both in the browser and during SSR. jsdom's own core HTML parser dependency,
`parse5`, has been ESM-only since at least `parse5@7.0.0` — confirmed present in every
jsdom major back to at least jsdom 20.x, with no CJS-only version to pin to. Node
20.19+/22.12+ support `require(esm)` natively on modern local Node, and this worked
fine in local testing — but **Vercel's production Node runtime does not support the
same interop for this dependency shape**, regardless of whether the surrounding code was
bundled by Turbopack or webpack. `serverExternalPackages` correctly marked the packages
external in both cases (the error always named the right package) — the failure is one
level deeper than anything a bundler config can route around.

Two earlier workaround attempts (pinning `jsdom`/`cssstyle` versions via `overrides`,
externalizing `jsdom`/`isomorphic-dompurify` in `next.config.js`, switching the build to
webpack) each fixed a real, distinct symptom along the way but never reached the actual
floor: jsdom's own core parser, which has no version escape hatch.

## The actual fix

**Remove jsdom from the server dependency graph entirely** — replace
`isomorphic-dompurify` with [`sanitize-html`](https://www.npmjs.com/package/sanitize-html)
in `src/components/blog/BlogPostBody.tsx` (the one call site that renders on the server).
`sanitize-html` uses `htmlparser2` (pure JS, no DOM shim, no ESM sub-dependencies), so
there is no `require(esm)` pattern for Vercel's runtime to reject. Confirmed: local
`next build` (webpack) compiles clean, `npm test` passes, and a sample markdown → HTML →
sanitize round-trip preserves headings/links/images/code blocks/tables while stripping
`<script>`.

This also let two prior workarounds be reverted as no-longer-needed:
`package.json`'s `jsdom`/`cssstyle` `overrides`, and `next.config.js`'s
`serverExternalPackages: ['jsdom', 'isomorphic-dompurify']`.

## Why this will bite another repo

Any package that shims a DOM via jsdom for isomorphic/SSR use (not just
`isomorphic-dompurify` — anything built the same way) carries this exact risk on Vercel,
independent of bundler choice. The diagnostic signature to watch for: `ERR_REQUIRE_ESM`
thrown at request time in production, naming `parse5` (or another jsdom-internal
dependency) from inside a path under `/opt/rust/` or similar Vercel-runtime-internal
location rather than an app-generated bundle file. If a package's own SSR path pulls in
jsdom, treat it as a Vercel-prod risk before it ships, not after.

## Prior (superseded) diagnosis

The original version of this doc claimed Turbopack's `externalRequire`/`externalImport`
wrapper functions didn't replicate Node's native `require(esm)` interop correctly. That
build-tool-specific mechanism was never actually confirmed once webpack reproduced the
identical failure — the true root cause was always one layer further down, in Vercel's
runtime. Left here so anyone who finds an old reference to "Turbopack's SSR loader bug"
for this incident knows it was corrected, not that a second bug exists.
