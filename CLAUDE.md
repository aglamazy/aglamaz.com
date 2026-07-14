# Aglamaz — agents-* horizontal libs (librarian lane)

This checkout holds the shared `agents-*` horizontal libraries (agents-ai, agents-agent,
agents-backoffice, agents-billing, agents-gdrive, agents-matching, agents-quota,
agents-voice, agents-whatsapp). They are consumed as git dependencies by the vertical
customer projects (Ilan-Oz, Elron, Cellwise, Einat, …). Cross-customer lib publishing is
the **librarian's lane** — it goes through this session, not through Buddy or customer
sessions (locked 2026-05-31 by Agla).

## `/classify … start` → execute, don't ask for the go (locked 2026-06-24 by Agla)

When Agla runs `/classify … start`, **start executing the session_supervised /
sub_agent_fanout tasks immediately — do NOT ask for approval to start or to "proceed."**
The `start` flag IS the go. The only things to surface back are genuine **feature /
product questions** (the `need_principal` content — what a thing should *do*, a design
fork I can't reasonably default). Never ask "should I build to this interface?" /
"want me to start now?" — just build, ship, and report. (`live` only changes that those
feature questions get answered in-chat instead of stalled to `/triage`.)

## Versioning: CalVer `YY.M.#`

Libs use CalVer, **never semver**. Format `YY.M.#` — two-digit year, month (no leading
zero), incrementing patch within the month. Git tag is `vYY.M.#`.

- First release in May 2026 → `26.5.0`, then `26.5.1`, `26.5.2`, …
- The `#` only resets when the year/month rolls over. Don't reset it to `0` mid-month and
  never downgrade a published version (consumers pin ranges).

## After sealing a version → push to origin (GitHub)

When a version is sealed (e.g. `26.5.1`), **push it to `origin` (GitHub) so it becomes
available to the horizontals' consumers.** A lib version that only exists locally is
invisible to every vertical that depends on it.

The seal-and-ship sequence per lib:

```bash
# bump package.json version to the new YY.M.#
git add -A
git commit -m "vYY.M.#: <what changed>"
git tag vYY.M.#
git push origin main vYY.M.#        # BOTH the branch and the tag
```

The `git push` of the **tag** is the step that publishes the version — consumers resolve
`agents-<lib>#vYY.M.#` against the remote. Forgetting the tag push (or pushing only the
branch) leaves consumers unable to install the new version.

## Close the ticket yourself — the moment it's published (Agla, 2026-07-09)

**The board must equal reality. The instant a lib task is published (tag verified on
origin), CLOSE its ticket yourself — do not wait to be asked, and never leave a shipped
ticket open.** For the Librarian lane, published IS done (`lib-Done = published`), so the
close is the last step of the seal, right after the tag push:

```bash
python3 ~/develop/Buddy/scripts/buddy_tasks.py close --project aglamaz_libs --task <N> --status done --by Librarian \
  --reason "Shipped in agents-<lib> vYY.M.# (tag verified on origin). <what changed>"
```

- Do this in the SAME turn as the seal — a published-but-open ticket is a stale board.
- A ticket stays open ONLY while its work is genuinely unfinished (e.g. a big multi-part
  build not yet shipped). If the board shows a ticket, it must be real pending work.
- This is the Librarian-lane instance of the fleet `task-lifecycle` rule (own your board,
  no reminder, no approval). Applies to inform-the-consumer too: close, then ping the
  consuming lane with the version to pin.

## Packaging: ship prebuilt `dist/`, no `prepare` script

Consumers install these as **git dependencies**, not from a registry. A `prepare: "tsc"`
script forces an isolated `npm install` at install time that 404s on private sibling peers
(e.g. agents-backoffice → agents-ai). So each lib must:

- commit a prebuilt `dist/` (remove `dist` from `.gitignore`, `git add -f dist`)
- have **no** `prepare` script in package.json
- point `main` at `dist/index.js`

agents-ai / agents-whatsapp / agents-agent already follow this. Any lib still running
`prepare: tsc` with no committed dist will break git-dep installs at the new version too —
fix packaging in the same seal that bumps the version.

## Ant owns the wide-eco-standard (`.husky/`) — track it, never edit in place

`.husky/pre-commit` is the **org-canonical** pre-commit hook, owned and maintained by Ant
(canonical source `~/develop/Ant/config/org-husky/.husky/pre-commit`). Ant overwrites it on
every daily sync, so **do not edit it in place** — to change the org-wide rule, edit Ant's
canonical file and let the next sync propagate everywhere.

- **Commit it** in every lib (it is tracked, not gitignored, not session cruft). Identical
  across all repos by design.
- It is **tooling only** — not published surface, not in `dist`, invisible to consumers — so
  committing/updating it does **not** warrant a version bump.
- **Activation is Ant's job**, out-of-band (`core.hooksPath`). We intentionally have **no**
  `prepare`/`husky install` script (it would re-break git-dep installs), so the hook is not
  self-activating from our side — don't add one to "turn it on".

What the hook enforces (worth knowing because it gates commits where active):
1. whitespace / merge-marker check on staged content
2. **agents-\* branch-pin ban** — a staged manifest may not pin an internal `agents-*` dep to
   a branch (`#main`, `#master`, `#feat/…`); only a tag (`#vYY.M.#`) or SHA passes. This is
   the mechanical enforcement of "consumers pin immutable versions, never a floating ref."
   (See `~/develop/Ant/docs/agents-pin-rule.md`.) → **Do not offer a `#latest`/branch pin to
   horizontals' consumers; it is dangerous and the hook will reject it.**
3. `lint-staged` on staged files
4. `tsc --noEmit` if a top-level `tsconfig.json` exists
