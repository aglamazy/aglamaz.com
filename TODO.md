# TODO

Items sorted by priority (highest first).

---

## 1. Photos Page — Pagination Bugs

**Active bugs affecting users.**

### Infinite scroll loads all photos instead of paginating
After the first 10 items load, the scroll handler (`page.tsx:218-233`) cascades through all remaining pages without user interaction. The trigger condition `scrollHeight - scrollTop - clientHeight < 500` stays true because rendered content doesn't create enough scroll buffer. Each batch triggers a re-check → loads next batch → repeats until exhausted.

**Contributing factors:**
- **API over-fetching** (`route.ts:34-38`): Each page request fetches `offset + limit` from **each** repository (occurrences + gallery), then merges/slices. Page N fetches N×10 items from each repo — quadratic growth.
- **offset=0 bug** (`route.ts:29`): `parseInt('0') || undefined` → `undefined` since 0 is falsy. Works by accident via `offset ?? 0` downstream, but fragile.

### Duplicate React key error (consequence of above)
`Encountered two children with the same key, 'OogLMrth5hgWewJKKzgt:0'` — the API's offset-based pagination over a merged sort is unstable. Items with identical timestamps swap positions between requests, landing in both pages. Client appends without deduplication.

**Fix (addresses both bugs):**
- [ ] Replace scroll handler with IntersectionObserver on a sentinel element
- [ ] Switch to cursor-based pagination (last seen date + id) — fixes quadratic over-fetch, unstable sort, and duplicate keys
- [ ] Fix `offset` parsing: use `?? undefined` instead of `|| undefined`
- [ ] Deduplicate on client when appending (safety net)

---

## 2. Blessing Pages — Replace Base64 Images with Firebase Storage

**Cost and reliability risk — base64 images in Firestore are expensive and hit the 1MB doc limit.**

- [ ] Create image upload API endpoint (`POST /api/upload/image`)
- [ ] Store images in Firebase Storage bucket, return URL
- [ ] Update EditorRich `images_upload_handler` to call API instead of base64
- [ ] Add image cleanup on blessing delete (optional)

---

## 3. Performance Optimization — Feed Loading

Phase 0 (SSR hydration) is done. Phase 2 (image resizing) is done. Remaining work:

### Phase 1: Feed Pagination
The `/app/photos` page has pagination (with bugs — see item 1). The main feed (`/app/page.tsx`) may still load everything at once.

- [ ] Verify `/app/page.tsx` feed uses paginated loading
- [ ] Ensure infinite scroll works correctly after item 1 is fixed

### Phase 3: Testing & Validation
- [ ] Test with 3G throttling, cache disabled
- [ ] Measure load time after pagination fix
- [ ] Test on actual mobile device (iOS/Android)

**Goal**: < 10 seconds on 3G throttled, cache disabled (was 35s).

---

## 4. Photos Page — Adapt Slideshow for Mobile

- [ ] Desktop slideshow works well; needs responsive adaptation for mobile (touch gestures, layout, sizing)

---

## 5. Relate User to Event (Event Honoree)

- [ ] Link a member to an anniversary event (e.g., whose birthday it is)
- Enables: "honoree" badge on blessings, auto-suggesting events, personalized notifications

---

## 6. Blessing Pages — Future Features

- [ ] Add reactions/likes to blessings (like blog post likes)

---

## 7. Profile Data Model Split

Current state: profile data is site-scoped via member documents (shared fields like displayName/email/avatar duplicated per site).

- [ ] Create global User doc (per uid) with displayName/firstName/email/avatarUrl/defaultLocale
- [ ] Keep Member doc per site with role/siteId/uid and site-specific toggles
- [ ] Add/adjust APIs so `/api/user/profile*` serves the global user
- [ ] Migrate existing member docs: backfill user docs from member fields
- [ ] Update client flows (EditUserDetails/profile) to use global user profile

---

## 8. Theming and Color System

- [ ] Define complete sage color scale (50-900) in tailwind.config.js
- [ ] Create centralized color palette file (src/styles/colors.ts) with semantic color names
- [ ] Add theme configuration system for dark/light mode support
- [ ] Refactor components to use semantic color names instead of hardcoded Tailwind classes

---

## 9. Firestore Backup Strategy

- [ ] Check if PITR is enabled: `gcloud firestore databases describe --database="(default)"`
- [ ] Enable PITR if not already active (7-day rolling point-in-time recovery)
- [ ] Set up scheduled exports to Cloud Storage
- [ ] Define retention policy (daily 30d, monthly 1y, yearly forever)
- [ ] Automate export schedule via Cloud Scheduler or Cloud Functions
- [ ] Document restore procedure

---

## 10. Hard Delete — GDPR Content Cleanup

Current hard-delete removes Firebase Auth + member doc. For full GDPR compliance, also need:

- [ ] Delete user's blog posts, blessings, photos, comments, likes
- [ ] Consider two-step delete pattern (soft delete → grace period → hard delete)
- [ ] Create `DeletionService` to orchestrate all cleanup
- [ ] Add audit logging and data export before deletion

---

## 11. Weekly Orphan Cleanup

When users are hard-deleted, orphaned references remain (likes, createdBy, authorId).

- [ ] Write cleanup script: query `likes` subcollections, delete docs for non-existent members
- [ ] Also clean orphaned refs in: galleryPhotos, anniversaryOccurrences, blessings, blogPosts, blessingPages
- [ ] Schedule weekly (Cloud Scheduler or Cloud Functions)
- [ ] Consider fixing hard-delete flow to clean up at delete time (reduces need for this)

---

## 12. Admin Route — `ADMIN_ANNIVERSARIES`

`AppRoute.ADMIN_ANNIVERSARIES` → `/admin/anniversaries` is defined but no page exists. Never used anywhere.

- [ ] Either create the admin anniversaries page or remove the route enum + path
