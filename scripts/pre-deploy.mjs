// `npm run pre-deploy` (famcircle#182; Buddy 51943): register this app's dead-man signals on a hub and
// write the slugs where the pingers read them - the same contract as ~/develop/Buddy/pre-deploy.sh, for
// this node project. Never a hand-built call: registration goes through agents-observe's registerDeadman.
//
// Reads    deadman.signals.json  (checked in; logical names, cadence, grace; NEVER a slug)
// Uses     ~/.config/deadman/register.env   DEADMAN_REGISTER_TOKEN (custody file, mode 600; read here in-process,
//                                           never in argv, never printed)
//          ~/.config/octopus/deadman.env    DEADMAN_SLUG_<name with - as _> (untracked, mode 600, shared with the
//                                           Buddy repo's pre-deploy.sh; a slug is minted here, high-entropy, only
//                                           when absent)
// Order    register and confirm the rows, THEN write the new slugs. An unregistered ping is a 404 and an alert.
// Prints   logical names and counts only. Never a slug, never the token.
// Exit     0 every signal confirmed on the hub, 1 anything else.
//
// Env      OCTOPUS_DEADMAN_BASE_URL  hub to use (default http://127.0.0.1:3001, the ub02 local hub)
//          DRY_RUN=1                 list what would be registered, send nothing, write nothing
//
// This is the ub02 / local-hub path. The Vercel production build registers through scripts/register-deadman.mjs
// with the slugs Zach puts in the Vercel env; a slug minted here is NOT the production slug.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerDeadman } from 'agents-observe';

const dryRun = process.env.DRY_RUN === '1';
const base = (process.env.OCTOPUS_DEADMAN_BASE_URL ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'deadman.signals.json'), 'utf8'));
const home = os.homedir();

function readEnvFile(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i)] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const slugEnvFile = path.join(home, '.config', 'octopus', 'deadman.env');
const slugEnv = readEnvFile(slugEnvFile);
const varFor = (name) => `DEADMAN_SLUG_${name.replace(/-/g, '_')}`;

const specs = cfg.signals.map((s) => {
  const v = varFor(s.name);
  let slug = slugEnv[v];
  let minted = false;
  if (!slug) {
    slug = `${s.name}-${crypto.randomBytes(5).toString('hex')}`;
    minted = true;
  }
  return { s, v, slug, minted };
});

console.log(`lane ${cfg.owning_lane}: ${specs.length} signal(s) -> ${base}${dryRun ? '  [DRY RUN, nothing sent]' : ''}`);
for (const x of specs) {
  console.log(`  - ${x.s.name}: ${x.s.period_seconds}s / ${x.s.grace_seconds}s, slug ${x.minted ? 'new (will be written to deadman.env)' : 'already in deadman.env'}`);
}
if (dryRun) process.exit(0);

const token = readEnvFile(path.join(home, '.config', 'deadman', 'register.env')).DEADMAN_REGISTER_TOKEN;
const outcome = await registerDeadman(
  {
    owning_lane: cfg.owning_lane,
    checks: specs.map((x) => ({ slug: x.slug, period_seconds: x.s.period_seconds, grace_seconds: x.s.grace_seconds })),
  },
  { config: { deadmanBaseUrl: base, deadmanRegisterToken: token } },
);

if (!outcome.ok) {
  console.error(`  NOT registered: ${outcome.reason}${outcome.status ? ` (HTTP ${outcome.status})` : ''}${outcome.error ? ` ${outcome.error}` : ''}`);
  if (outcome.detail) console.error(`  detail: ${outcome.detail}`);
  if (outcome.conflicts?.length) {
    console.error(`  ${outcome.conflicts.length} signal(s) already registered with DIFFERENT values; nothing was overwritten (a pace change is a hub admin step)`);
  }
  process.exit(1);
}

console.log(`  registered: created ${outcome.created.length}, already existing ${outcome.existing.length}`);
const toAppend = specs.filter((x) => x.minted).map((x) => `${x.v}=${x.slug}`);
fs.mkdirSync(path.dirname(slugEnvFile), { recursive: true, mode: 0o700 });
let text = fs.existsSync(slugEnvFile)
  ? fs.readFileSync(slugEnvFile, 'utf8')
  : '# dead-man slugs and hub for jobs on this host. Mode 600, never in git, never printed.\n';
if (!/^OCTOPUS_DEADMAN_BASE_URL=/m.test(text)) text += `OCTOPUS_DEADMAN_BASE_URL=${base}\n`;
for (const l of toAppend) text += `${l}\n`;
fs.writeFileSync(slugEnvFile, text, { mode: 0o600 });
fs.chmodSync(slugEnvFile, 0o600);
console.log(`slugs: ${toAppend.length} new written to ${slugEnvFile} (mode 600); hub url ${/^OCTOPUS_DEADMAN_BASE_URL=/m.test(text) ? 'present' : 'missing'}`);
