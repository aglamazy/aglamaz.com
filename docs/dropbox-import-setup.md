# Dropbox Photo Import — Setup & Status

## Current Status: Dropbox App Permissions Issue

### What's Done
- Dropbox app created (App ID: 5965187, key: `5bo8j6jt8ytt5uq`)
- OAuth flow working — refresh token obtained
- Scopes enabled: `files.metadata.read`, `files.content.read`, `sharing.read`
- Connected account: Yaakov Aglamaz (yaakov.aglamaz@gmail.com)

### The Problem
The Dropbox app was created with **"App folder"** access type, which limits it to a sandboxed `Apps/` subfolder. It cannot see files in your full Dropbox.

### Next Step: Choose One Option

#### Option A: Recreate app with "Full Dropbox" access (simpler)
1. Go to https://www.dropbox.com/developers/apps
2. **Create a new app** (access type can't be changed after creation):
   - API: **Scoped access**
   - Access type: **Full Dropbox**
   - Name: e.g. `aglamaz-import-full`
3. On the **Permissions** tab, enable:
   - `files.metadata.read`
   - `files.content.read`
   - `sharing.read`
   - Click **Submit**
4. Copy the new **App key** and **App secret** from the Settings tab
5. Update `.env.local`:
   ```
   DROPBOX_APP_KEY=<new key>
   DROPBOX_APP_SECRET=<new secret>
   ```
6. Re-authorize by opening:
   ```
   https://www.dropbox.com/oauth2/authorize?client_id=<NEW_APP_KEY>&response_type=code&token_access_type=offline
   ```
7. Give me the authorization code — I'll exchange it for a refresh token
8. Update `.env.local`:
   ```
   DROPBOX_REFRESH_TOKEN=<new refresh token>
   ```

**Pros**: Editors can paste either a folder path URL (`/home/...`) or a shared link. Simplest API calls.

#### Option B: Keep current app, use shared links only
The current app can still access shared folder links via the `sharing` API — even with "App folder" access. The editor flow would require pasting a **shared link** (e.g. `https://www.dropbox.com/scl/fo/...`) rather than a `/home/` URL.

To test this, we need a shared link for the folder:
- In Dropbox web: right-click the folder → "Share" → "Copy link"

**Pros**: No app recreation needed.
**Cons**: Only works with shared links, not direct folder paths.

### Recommendation
**Option A** is the better platform solution — it supports both shared links and direct folder browsing, and is more flexible for future use cases.

---

## Environment Variables (`.env.local`)

```
DROPBOX_APP_KEY=<app key>
DROPBOX_APP_SECRET=<app secret>
DROPBOX_REFRESH_TOKEN=<refresh token from OAuth>
```

Remove the old `DROPBOX_TOKEN` entry — it was an access token (short-lived), not a refresh token.

---

## Implementation Plan (unchanged)

Once Dropbox access is working, the full implementation is:

| # | Action | File |
|---|--------|------|
| 1 | Install `sharp` | `package.json` |
| 2 | New | `src/services/DropboxService.ts` — Dropbox API wrapper (token refresh, browse, thumbnails, download) |
| 3 | New | `src/services/ServerImageProcessor.ts` — sharp resize + Firebase Storage upload |
| 4 | Modify | `src/entities/Routes.ts` — add `SITE_DROPBOX_BROWSE`, `SITE_DROPBOX_IMPORT` |
| 5 | Modify | `src/utils/urls.ts` — add API path templates |
| 6 | New | `src/app/api/site/[siteId]/dropbox/browse/route.ts` — browse endpoint |
| 7 | New | `src/app/api/site/[siteId]/dropbox/import/route.ts` — import endpoint |
| 8 | Modify | `src/repositories/AnniversaryOccurrenceRepository.ts` — add `dropboxFolderUrl` field |
| 9 | New | `src/components/dropbox/DropboxImportModal.tsx` — UI modal |
| 10 | Modify | `src/app/app/anniversaries/[id]/events/[eventId]/page.tsx` — wire in modal |

## Test File
`test-dropbox.mjs` at project root — used for API testing. Delete when done.
