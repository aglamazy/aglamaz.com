#!/usr/bin/env node
// Shofar's periodic blog-draft submission CLI (Agla 2026-08-12).
//
// Self-contained on purpose - no imports from this repo. This file is meant to be copied
// into Shofar's OWN working environment and run from there, so it only talks to
// aglamaz.com over plain HTTP (the same endpoints the site's own browser UI uses) and
// needs nothing beyond Node 18+.
//
// Identity: interim decision (Agla 2026-08-12) is that this authenticates AS AGLA
// PERSONALLY, via his own refresh_token - NOT a separate service identity. That's a
// deliberate, temporary choice pending a proper spec (raised for the Board Meeting: Dasi
// writes the technical spec with Compass's product view, Librarian implements). Treat the
// token file this script reads/writes as equivalent to Agla's own login session.
//
// What this does, every run:
//   1. Reads a locally-stored refresh_token, exchanges it at /api/auth/refresh for a
//      fresh access_token - and PERSISTS the rotated refresh_token it gets back, because
//      the old one is invalidated the instant it's used (reuse-detection on the server
//      side). Skipping the write-back breaks the NEXT run, not this one.
//   2. Creates a blog post draft: isPublic:true, status:'draft' - never 'published'.
//      Going live requires a separate, explicit admin decision through the normal
//      review flow (BlogRepository.decideReview('approved')) - this script cannot do
//      that and never will.
//   3. Requests review, which emails site admins a link to /review/{token} on
//      aglamaz.com. That's where the actual publish/fix/deny decision happens.
//
// Bootstrap (one-time, manual - see README.md in this directory): there is no
// self-service way to mint the first refresh_token from this script. Agla logs into
// aglamaz.com once, hands over that session's refresh_token value, and it's written to
// the token file below. Every run after that rotates it forward on its own.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TOKEN_PATH = process.env.AGLAMAZ_BLOG_TOKEN_PATH || path.join(os.homedir(), '.config', 'aglamaz-blog-token');
const SITE_ORIGIN = process.env.AGLAMAZ_SITE_ORIGIN || 'https://aglamaz.com';
// No fallback for siteId (FamCircle CLAUDE.md: never use fallback values for anything
// that should be explicitly provided) - must be set by whoever runs this.
const SITE_ID = process.env.AGLAMAZ_SITE_ID;

function die(msg) {
  console.error(`[blog-submit] ${msg}`);
  process.exit(1);
}

function readRefreshToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    die(`No token file at ${TOKEN_PATH}. Bootstrap it first - see README.md (Agla logs in once, hands you the refresh_token value).`);
  }
  const raw = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  if (!raw) die(`Token file ${TOKEN_PATH} is empty.`);
  return raw;
}

function writeRefreshToken(value) {
  fs.writeFileSync(TOKEN_PATH, value, { mode: 0o600 });
}

function parseSetCookie(setCookieHeaders, name) {
  for (const line of setCookieHeaders) {
    const [pair] = line.split(';');
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const key = pair.slice(0, eq).trim();
    if (key === name) return pair.slice(eq + 1).trim();
  }
  return null;
}

function getSetCookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

async function refresh(refreshToken) {
  const res = await fetch(`${SITE_ORIGIN}/api/auth/refresh`, {
    method: 'POST',
    headers: { Cookie: `refresh_token=${refreshToken}` },
  });
  if (!res.ok) {
    die(`Refresh failed: HTTP ${res.status}. Token may be dead or already rotated by a concurrent run - re-bootstrap if this persists.`);
  }
  const setCookie = getSetCookieHeaders(res);
  const accessToken = parseSetCookie(setCookie, 'access_token');
  const newRefreshToken = parseSetCookie(setCookie, 'refresh_token');
  if (!accessToken) die('Refresh response had no access_token cookie.');
  if (!newRefreshToken) die('Refresh response had no rotated refresh_token cookie.');
  writeRefreshToken(newRefreshToken);
  return accessToken;
}

async function createDraft(accessToken, { title, content, contentFormat, lang }) {
  const res = await fetch(`${SITE_ORIGIN}/api/site/${SITE_ID}/blog`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `access_token=${accessToken}`,
    },
    body: JSON.stringify({ title, content, isPublic: true, status: 'draft', contentFormat, lang }),
  });
  const body = await res.json();
  if (!res.ok) die(`Create draft failed: HTTP ${res.status} - ${JSON.stringify(body)}`);
  return body.post;
}

async function requestReview(accessToken, postId) {
  const res = await fetch(`${SITE_ORIGIN}/api/site/${SITE_ID}/blog/${postId}/request-review`, {
    method: 'POST',
    headers: { Cookie: `access_token=${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) die(`Request review failed: HTTP ${res.status} - ${JSON.stringify(body)}`);
  return body;
}

function parseArgs(rest) {
  const args = {};
  for (let i = 0; i < rest.length; i += 2) {
    args[rest[i].replace(/^--/, '')] = rest[i + 1];
  }
  return args;
}

async function main() {
  if (!SITE_ID) die('AGLAMAZ_SITE_ID env var is required (no default).');
  const [, , command, ...rest] = process.argv;
  if (command !== 'submit-draft') {
    die('Usage: blog-submit.mjs submit-draft --title-file <path> --content-file <path> [--lang en] [--format md]');
  }
  const args = parseArgs(rest);
  if (!args['title-file'] || !args['content-file']) {
    die('Missing --title-file or --content-file.');
  }
  const title = fs.readFileSync(args['title-file'], 'utf8').trim();
  const content = fs.readFileSync(args['content-file'], 'utf8');
  const contentFormat = args.format === 'html' ? 'html' : 'md';
  const lang = args.lang || 'en';

  const refreshToken = readRefreshToken();
  const accessToken = await refresh(refreshToken);
  const post = await createDraft(accessToken, { title, content, contentFormat, lang });
  const { reviewUrl } = await requestReview(accessToken, post.id);

  console.log(`Created draft ${post.id}`);
  console.log(`Review requested - admin(s) notified. Review URL: ${reviewUrl}`);
}

main().catch((err) => die(err.stack || String(err)));
