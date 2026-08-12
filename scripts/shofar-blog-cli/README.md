# Shofar blog-submit CLI

Submits a blog post draft to aglamaz.com for admin review, headlessly. Built per Agla's
direct request 2026-08-12. Copy `blog-submit.mjs` into your own working environment - it
has no dependency on the FamCircle repo, just Node 18+.

## Identity (read this first)

This is an **interim** design. It authenticates as Agla's own personal account (his
refresh_token), not a separate service identity - his explicit call, given a bigger
question about agent-vs-principal identity that's being raised at the Board Meeting
(Dasi writes the technical spec with Compass's product view, Librarian implements).
Treat the token as equivalent to his own login session: anything this script does is
indistinguishable from him doing it himself. It never publishes anything - see below.

## What it does / doesn't do

- Creates a post with `isPublic:true, status:'draft'` - always draft, never published.
- Requests review, which emails the site's admin(s) a link to `/review/{token}` on
  aglamaz.com. That review page is where Publish/Fix/Deny actually happens - by a human,
  in the app, same as any other post.
- Does **not** publish, approve, or deny anything. There is no code path in this script
  that can make a post go live.

## One-time bootstrap

There's no self-service way to mint the first token from this script - Agla has to log
into aglamaz.com once and hand over that session's `refresh_token` cookie value.

1. Agla logs into aglamaz.com normally, in a browser.
2. From dev tools → Application/Storage → Cookies, copy the value of `refresh_token`.
3. Write it to the token file (path below), mode 600:
   ```bash
   printf '%s' '<the refresh_token value>' > ~/.config/aglamaz-blog-token
   chmod 600 ~/.config/aglamaz-blog-token
   ```

Every run after that rotates the token forward on its own and rewrites the same file -
no further manual steps unless the token file is lost or the session is revoked, in
which case: re-bootstrap.

**Token storage** (per Buddy's fleet convention, msg 22669): the real secret lives at
`~/develop/Buddy/secrets/aglamaz-blog-refresh-token` (gitignored), reached via a stable
symlink at `~/.config/aglamaz-blog-token`. Set those up once:
```bash
touch ~/develop/Buddy/secrets/aglamaz-blog-refresh-token
chmod 600 ~/develop/Buddy/secrets/aglamaz-blog-refresh-token
ln -s ~/develop/Buddy/secrets/aglamaz-blog-refresh-token ~/.config/aglamaz-blog-token
```
Then do the bootstrap write above (it follows the symlink automatically).

**If the token ever leaks**: rotate it, not "assess and decide" - Buddy's standing rule.
Re-run the bootstrap step with a fresh login.

## Usage

```bash
export AGLAMAZ_SITE_ID='XFptrxZIKXV6P2TjtGCL'   # aglamaz.com - no default, must be set
node blog-submit.mjs submit-draft \
  --title-file ./draft-title.txt \
  --content-file ./draft-content.md \
  --lang en \
  --format md
```

- `--title-file` - plain text, single line (trailing whitespace trimmed).
- `--content-file` - markdown (default) or HTML body, per `--format`.
- `--lang` - defaults to `en`. **Must match the actual language of the content** - the
  site stores content keyed by this locale and drives RTL/LTR off it. Getting this wrong
  silently mistags the post (this bit an earlier draft the same day this CLI was built -
  see famcircle's 2026-08-12 day log if curious).

Env vars (all required except `AGLAMAZ_SITE_ORIGIN`, which defaults to
`https://aglamaz.com`):
- `AGLAMAZ_SITE_ID` - required, no default.
- `AGLAMAZ_BLOG_TOKEN_PATH` - optional override of the token file path (defaults to
  `~/.config/aglamaz-blog-token`).

## Errors

The script fails loudly (non-zero exit, message to stderr) rather than silently
skipping - a dead token, a missing file, a rejected API call all stop the run. It does
not retry or fall back to anything.
