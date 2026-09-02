/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // famcircle#167 (ant_executor#1947): an empty turbopack:{} is a false clean - it
  // enables turbopack but never pins root, so Next falls back to its own
  // outermost-lockfile inference. That's exactly the misresolution bug the
  // ~/develop/Aglamaz parent-tree cleanup (ant_executor#1930) was guarding
  // against - a real pin here means this repo's root can never again be inferred
  // from a sibling/parent directory's lockfile.
  turbopack: { root: __dirname },
  // aglamaz_libs#279 (PROD 500 on every /blog route): jsdom's dep chain
  // (html-encoding-sniffer@^6 -> @exodus/bytes, ESM-only, engines pin to
  // Node 20.19+/22.12+'s require(esm) support) resolves fine under Node's
  // own module loader -- confirmed directly: `require('@exodus/bytes/encoding-lite.js')`
  // works standalone. It only breaks inside Turbopack's SSR bundle, which
  // doesn't replicate that native ESM interop and throws ERR_REQUIRE_ESM.
  // Excluding jsdom (pulled in by isomorphic-dompurify for SSR sanitization)
  // from the server bundle routes its requires through Node's own loader
  // instead, where this already works.
  serverExternalPackages: ['jsdom'],
};

module.exports = nextConfig;
