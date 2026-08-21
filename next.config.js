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
};

module.exports = nextConfig;
