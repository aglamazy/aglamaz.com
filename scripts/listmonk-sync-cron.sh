#!/usr/bin/env bash
# Pull-cron wrapper for scripts/sync-listmonk-subscribers.ts (ElronCar-baseline shape,
# per Buddy's 2026-08-03 approval on famcircle's blog-subscriber -> Listmonk sync).
#
# Runs on ub04 as the `fcsync` service user, wired via ops/systemd/listmonk-sync.{service,timer}.
# Always pulls the latest `dev` before running, so updates to the sync script land without a
# separate deploy step to this host - the git checkout IS the deploy.
#
# Requires FAMCIRCLE_CHECKOUT_DIR (where this repo is cloned on ub04) - no fallback, sourced
# from the systemd unit's Environment= line, not this script, since the path is host-specific.
set -euo pipefail

if [ -z "${FAMCIRCLE_CHECKOUT_DIR:-}" ]; then
  echo "[listmonk-sync-cron] FAMCIRCLE_CHECKOUT_DIR is not set" >&2
  exit 1
fi

cd "$FAMCIRCLE_CHECKOUT_DIR"
git fetch origin dev
git reset --hard origin/dev

npx tsx scripts/sync-listmonk-subscribers.ts
