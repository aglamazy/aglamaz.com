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
  // aglamaz_libs#279 / famcircle#170 (PROD 500 on every /blog route): Turbopack's
  // SSR bundler mishandles jsdom (pulled in by isomorphic-dompurify) two ways -
  // it can't replicate Node's require(esm) interop for jsdom's transitive deps,
  // and it rewrites jsdom's internal `require()` of its own default-stylesheet.css
  // asset to a virtual path that doesn't exist on disk (ENOENT). Marking jsdom
  // external routes all of its requires through Node's own loader at runtime,
  // where both problems disappear - real fs resolution, real ESM interop.
  // Paired with pinning jsdom to 27.3.0 in package.json's overrides (jsdom 27.4+
  // and 29.x pull an ESM-only html-encoding-sniffer@^6 -> @exodus/bytes chain
  // that even Node's native interop couldn't satisfy on Vercel's actual runtime -
  // confirmed via live function logs, not just local repro).
  // 'jsdom' alone doesn't cover it: npm nests a private copy at
  // isomorphic-dompurify/node_modules/jsdom (its own version pin diverges from
  // the root override below), and Turbopack's externals matching didn't reach
  // that nested copy - confirmed via repeated local repro (ENOENT on jsdom's
  // own default-stylesheet.css asset, still routed through Turbopack's runtime
  // require wrapper). Externalizing the whole isomorphic-dompurify package
  // stops Turbopack from touching any of its internals, nested jsdom included.
  serverExternalPackages: ['jsdom', 'isomorphic-dompurify'],
};

module.exports = nextConfig;
