#!/usr/bin/env bash
# Vercel installCommand hook (famcircle#171).
#
# The private agents-* libs (agents-observe) are github:aglamazy/* git dependencies. Vercel has no SSH key
# for those repos, and npm resolves them over git regardless of the protocol in package.json, so the build
# rewrites GitHub URLs to carry a short-lived GitHub App installation token before `npm install` runs.
# Design and rationale: AgentsHead/Octopus/docs/design-1913-vercel-private-npm-app-token.md (section 2).
#
# Auth: GitHub App "ah-deploy-agents" - a fresh 1-hour installation token is minted at deploy time by
# scripts/mint-gh-token.cjs. Requires on the Vercel project (every target it deploys to):
#   AH_APP_ID, AH_APP_INSTALLATION_ID, AH_APP_PRIVATE_KEY_B64
# Missing credentials fail the install: a private dependency cannot be fetched without them, and a build
# that limps on fails later with a less obvious message.
#
# Never add GIT_TRACE / GIT_TRACE_PACKET / GIT_CURL_VERBOSE here: the token is embedded in the rewritten URL
# and those flags print it into the build log (found 2026-08-21, ah-mgr#641).
set -euo pipefail

# No TTY on Vercel: without these, an auth failure hangs the build on a credential prompt instead of failing.
export GIT_TERMINAL_PROMPT=0
export GIT_ASKPASS=/bin/echo

if [ -z "${AH_APP_ID:-}" ] || [ -z "${AH_APP_INSTALLATION_ID:-}" ] || { [ -z "${AH_APP_PRIVATE_KEY_B64:-}" ] && [ -z "${AH_APP_PRIVATE_KEY:-}" ]; }; then
  echo "[vercel-install] missing AH_APP_ID / AH_APP_INSTALLATION_ID / AH_APP_PRIVATE_KEY_B64 on this Vercel target - cannot fetch private agents-* dependencies" >&2
  exit 1
fi

echo "[vercel-install] minting GitHub App installation token (ah-deploy-agents)..."
# The mint script uses Node's built-in crypto: no npm install is needed (an earlier version installed
# jsonwebtoken here and hung the build).
if ! TOKEN=$(node scripts/mint-gh-token.cjs); then
  echo "[vercel-install] mint-gh-token failed - aborting install" >&2
  exit 1
fi
if [ -z "$TOKEN" ]; then
  echo "[vercel-install] mint-gh-token returned an empty token - aborting" >&2
  exit 1
fi
echo "[vercel-install] minted installation token (length=${#TOKEN})"

# All three forms: npm's pacote tries the HTTPS URL and falls back to SSH, and lockfiles record either.
REWRITE="https://x-access-token:${TOKEN}@github.com/"
git config --global "url.${REWRITE}.insteadOf" "ssh://git@github.com/"
git config --global --add "url.${REWRITE}.insteadOf" "git@github.com:"
git config --global --add "url.${REWRITE}.insteadOf" "https://github.com/"

npm install
