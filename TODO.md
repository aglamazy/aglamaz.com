# Auth UX — Reduce Reauthenticate Prompts

## Summary
- Current middleware verifies access tokens on every page request and rewrites to `/auth-gate` when expired, even though client APIs can refresh tokens. This causes frequent “reauthenticate” prompts and blocks initial paint.

## Recommendations
- Soft Page Middleware: For non-API routes, if an `access_token` cookie exists, allow the page to load without immediate verification. Enforce auth on API routes (`withMemberGuard`) and during data fetches.
- Align Access TTL: Increase access token lifetime to 30–60 minutes to match UX expectations (cookie maxAge is already 120m). Keep refresh token at 30 days.
- Public-Load, Protected-Data: Treat app pages like `/calendar` as public for initial HTML; fetch protected data via guarded APIs using `apiFetch` (auto refreshes on 401).
- Centralize Client Check: Trigger a single `checkAuth()` in the client layout shell to populate user/member state once, not per page.
- Background Refresh: From the shell, silently refresh before expiry (e.g., 80–90% of TTL). Use the existing `refreshOnce` guard to avoid request storms.
- Skip Member Probe In Middleware: Remove the `member-info` call for non-API routes. Let the client or server loader fetch member info when needed.
- Strict Only Where Needed: Keep middleware strict for routes that SSR sensitive content directly into HTML; otherwise keep it soft as above.
- Clock Skew Tolerance: Allow small skew (e.g., 5–15s) when verifying tokens at the edge to avoid borderline expirations.
- Telemetry: Log refresh successes/failures and count of middleware rewrites to `/auth-gate` to measure improvement.

## Proposed Steps
- Middleware
  - [ ] Detect non-API route with token present → `NextResponse.next()` (no early rewrite)
  - [ ] Keep strict handling for `/api/**` and truly private SSR routes
- Auth Service
  - [ ] Increase `accessMin` in `api/auth/login` (e.g., 45–60)
  - [ ] Consider matching cookie `maxAge` with token TTL or keep slightly higher to allow refresh
- Client Shell
  - [ ] Fire `checkAuth()` once, store in `UserStore`
  - [ ] Add background timer: call `/api/auth/me` or `/api/auth/refresh` before TTL
  - [ ] Ensure all data loads use `apiFetch` (already refresh-aware)
- Pages/Data
  - [ ] Confirm all sensitive data comes from guarded APIs (no accidental SSR leakage)

## Acceptance Criteria
- Navigating between pages does not trigger `/auth-gate` when the cookie exists; first protected API call refreshes seamlessly.
- Token refresh happens in the background with no visible prompts.
- No unauthenticated access to protected data (API routes still enforce guard).
- Error paths still redirect to login on hard 401s (no infinite loops).

## Rollout Notes
- Start with middleware softening + longer TTL in staging.
- Monitor metrics for 3–5 days: refresh rates, rewrite counts, 401s.
- Adjust TTL and background interval based on observed churn.

## When refresh token is needed, it is done correctly, but the page is not redirected to /app

# Translation Architecture Migration

## BlogPost Collection
- [ ] Migrate BlogPost entity from `translations` to `locales` structure
- [ ] Update BlogRepository to use new locales structure
- [ ] Update blog-related API routes
- [ ] Update blog pages to work with new structure
- [ ] Create migration script to convert existing blog posts from old to new structure

# Blog Registration and Setup Flow

## Background
According to README.md, before a member can write blog posts, they must register their blog. Currently, the system has:
- ✅ `blogEnabled` flag in Member entity
- ✅ `blogHandle` field for unique blog URLs
- ✅ `MemberRepository.setBlogEnabled()` method
- ✅ `MemberRepository.generateUniqueBlogHandle()` for uniqueness

## Missing Implementation
- [ ] Create blog setup modal/page for first-time users
  - Should open when user clicks "New Post" without a registered blog
  - Collect blog slug (suggest from email, allow editing)
  - Validate slug uniqueness in real-time
  - Save blog settings (`blogEnabled: true`, `blogHandle: <slug>`)
- [ ] Add API endpoint for blog registration
  - `POST /api/user/[userId]/blog/register` or similar
  - Validate slug uniqueness within site
  - Set blogEnabled and blogHandle in one transaction
- [ ] Update post creation to check for blog registration
  - In `/app/blog/new`, check if user has `blogEnabled` and `blogHandle`
  - If not, redirect/show modal for blog setup
- [ ] Add blog settings page (optional for now)
  - Allow viewing blog slug (read-only after initial setup per README)
  - Toggle blogEnabled on/off
  - View blog URL

## User Flow
1. User clicks "Add Post" FAB or "New Post" button
2. System checks: `member.blogEnabled && member.blogHandle`
3. If NO → Open blog setup modal
   - Show suggested slug from email (e.g., "yaakov-aglamaz")
   - Allow editing slug
   - Validate uniqueness as user types
   - Show preview URL: `/blog/{slug}`
   - "Create Blog" button saves settings
4. If YES → Navigate to post creation page

## Notes
- Blog slug is **immutable** after creation (per README)
- Slug must be unique within the site
- Current `/app/blog` already has `BlogCTA` component for enabling blogs, but it needs proper slug collection

# Theming and Color System

## Goals
- Support dark/light mode theming
- Centralized color palette management
- Easy to extend for future themes

## Tasks
- [ ] Define complete sage color scale (50-900) in tailwind.config.js
- [ ] Create centralized color palette file (src/styles/colors.ts) with semantic color names
- [ ] Add theme configuration system for dark/light mode support
- [ ] Refactor components to use semantic color names instead of hardcoded Tailwind classes

# Blessing Pages

## Current Implementation
- ✅ BlessingPage entity (page metadata: eventId, year, slug)
- ✅ BlessingPageRepository with CRUD operations
- ✅ API routes for creating/fetching blessing pages
- ✅ Calendar modal integration with create/view blessing page
- ✅ Blessing page view (/blessing/[slug])
- ✅ Blessing entity (individual blessing messages)
- ✅ BlessingRepository with full CRUD
- ✅ API routes for posting/editing/deleting blessings
- ✅ TinyMCE rich text editor with celebration emojis
- ✅ Delete functionality in editor
- ✅ Permission system (author + admin can edit/delete)
- ✅ Inline photo upload (currently base64)

## Future Features
- [ ] Add reactions/likes to blessings (like blog post likes)
- [ ] Link event owner to member - show "Event honoree" badge on their blessings

## Image Storage Optimization
- [ ] **IMPORTANT: Replace base64 image storage with Firebase Storage**
  - **Problem:** Base64-encoded images in Firestore are expensive:
    - Base64 encoding increases image size by ~33%
    - Every blessing view reads large documents (high read costs)
    - Firestore 1MB document size limit can be hit quickly
    - Storage costs higher than Cloud Storage
  - **Solution:** Upload images to Firebase Storage, store only URLs in Firestore
  - **Tasks:**
    - [ ] Create image upload API endpoint (`POST /api/upload/image`)
    - [ ] Store images in Firebase Storage bucket
    - [ ] Return public URL or signed URL
    - [ ] Update EditorRich `images_upload_handler` to call API instead of base64
    - [ ] Add image cleanup on blessing delete (optional, consider orphaned images)
  - **Benefits:**
    - Much cheaper storage costs
    - Faster document reads/writes
    - No document size limits
    - CDN delivery for images

# Hard Delete User Feature

## Current Implementation
- ✅ Admin API endpoint: `DELETE /api/admin/users/[userId]/hard-delete`
  - Deletes Firebase Auth user
  - Deletes member document via MemberRepository
  - Prevents self-deletion
  - Returns summary of deleted resources
- ✅ Admin UI in site-members page
  - "Hard Delete" button next to regular delete
  - ConfirmDialog with destructive styling
  - Proper error handling and loading states
- ✅ Translation keys added (he/en/tr)

## Future Enhancements (GDPR Compliance)
When a user requests full data deletion (GDPR "right to be forgotten"):

### Content Cleanup Tasks
- [ ] **Blog Posts**: Delete all blog posts authored by the user
  - Query: `posts` collection where `authorId === userId`
  - Delete post documents and any associated media
- [ ] **Blessings**: Delete all blessing messages posted by the user
  - Query: `blessings` collection where `authorId === userId`
  - Consider: Keep anonymous or replace with "[deleted user]"?
- [ ] **Photos**: Delete photos uploaded by the user
  - Query: `photos` collection where `uploadedBy === userId`
  - Delete from Firebase Storage as well
- [ ] **Comments**: Handle comments/reactions by the user
  - Either delete or anonymize
- [ ] **Likes/Reactions**: Remove user's likes on posts/blessings
  - Update like counts on affected documents

### Two-Step Delete Pattern (Recommended for Production)
Instead of immediate hard delete, consider a two-step process:

1. **Soft Delete** (Current "Delete" button):
   - Set `member.status = 'deleted'`
   - Set `member.deletedAt = timestamp`
   - User cannot log in (middleware rejects)
   - Member still visible to admins (for audit)

2. **Hard Delete** (After grace period):
   - Run after 30-90 days
   - Actually delete Firebase Auth + all content
   - Can be scheduled job or manual admin action
   - Gives time to recover from mistakes

### Implementation Notes
- Current implementation is **minimum viable** for testing onboarding flows
- For GDPR compliance, will need content cleanup + grace period
- Consider creating a `DeletionService` to orchestrate all cleanup
- Log all deletions for audit trail
- Consider data export before deletion (GDPR requirement)

# Automatic Versioning System

## Implementation
- ✅ Version utility: `src/utils/version.ts`
  - Reads version from `package.json` using `@/../package.json` alias
  - Provides `getVersion()` function for consistent access
- ✅ Health API endpoint: `/api/health`
  - Includes `version` field in response
  - Useful for monitoring and debugging
- ✅ Footer component
  - Displays version in copyright line: `© 2025 SiteName. v1.0.0. All rights reserved.`
- ✅ Auto-increment on push
  - Script: `scripts/increment-version.js` increments patch version
  - Husky hook: `.husky/pre-push` runs script and amends commit
  - Version bumps automatically on every `git push`

## How It Works
1. Developer commits changes normally
2. On `git push`, pre-push hook triggers
3. Script reads `package.json`, increments patch version (1.0.0 → 1.0.1)
4. Updated `package.json` is staged and committed via `--amend`
5. Push continues with updated version

## Version Format
- Using semantic versioning: `MAJOR.MINOR.PATCH`
- Currently auto-incrementing PATCH on every push
- Manual version bumps:
  - Minor: `npm version minor` (1.0.5 → 1.1.0)
  - Major: `npm version major` (1.1.0 → 2.0.0)

---

# Performance Optimization - Feed Loading

## Goal
**Beat the current 35-second load time!**

Current baseline (3G throttling, cache disabled, no images): **~35 seconds**

## Root Cause Analysis

### Critical Issues (Phase 0 - Must Fix First!) 🚨
From latest waterfall analysis with all feeds disabled:
- ❌ **`/api/auth/me` returns 401** - causing 2+ second delay
- ❌ **`/api/site` client fetch** - should be SSR'd in layout (currently IS server-fetched but not hydrated properly)
- ❌ **`/api/user/member-info` client fetch** - should be SSR'd in layout

**Current Architecture:**
- ✅ Layout DOES fetch `siteInfo` on server (line 30-36 in `app/layout.tsx`)
- ✅ Layout DOES inject `window.__SITE_INFO__` for hydration (line 45-50)
- ❌ BUT `ClientLayoutShell` STILL calls `/api/site` on line 96
- ❌ `UserStore.checkAuth()` calls `User.me()` which calls `/api/auth/me`
- ❌ `MemberStore.fetchMember()` calls `/api/user/member-info`

**Fix Strategy:**
1. SSR user data in layout (similar to siteInfo)
2. SSR member data in layout
3. Inject both via `window.__USER__` and `window.__MEMBER__`
4. Update stores to hydrate from window instead of API calls

### Secondary Issues (Phase 1+)
- ❌ Loading ALL photos/anniversaries at once (~50+ parallel API calls)
- ❌ Each API call fetches individual photo/anniversary/likes data
- ❌ Network congestion from too many parallel requests
- ❌ Images not optimized for mobile (full resolution)

## Phase 0: Fix SSR Hydration (MUST DO FIRST!) ⚡

**Goal**: Eliminate 3 unnecessary API calls on every page load
**Expected improvement**: ~6 seconds faster (3 API calls × 2s each)

### Backend Changes
- [ ] Add user data fetching in `app/layout.tsx` server component
  - Use existing `getMemberFromToken()` helper
  - Get user from Firebase Auth token
- [ ] Add member data fetching in `app/layout.tsx`
  - Already have `member` from `getMemberFromToken()`
  - Just need to pass it to client
- [ ] Inject user and member data into HTML:
  ```tsx
  <script id="__USER__" dangerouslySetInnerHTML={{
    __html: `window.__USER__=${JSON.stringify(userData ?? null)};`,
  }} />
  <script id="__MEMBER__" dangerouslySetInnerHTML={{
    __html: `window.__MEMBER__=${JSON.stringify(member ?? null)};`,
  }} />
  ```

### Frontend Changes
- [ ] Add `hydrateFromWindow()` to `UserStore`
  - Read from `window.__USER__` on mount
  - Skip `/api/auth/me` call if hydrated
- [ ] Update `UserStore.checkAuth()` to try hydration first
- [ ] Add `hydrateFromWindow()` to `MemberStore` (already exists!)
- [ ] Update `ClientLayoutShell` to call both hydrations on mount
- [ ] Remove `/api/site` fetch in `ClientLayoutShell` line 96 (already hydrated!)

### Expected Impact
- Remove 3 API calls: `/api/auth/me`, `/api/site`, `/api/user/member-info`
- Save ~6 seconds on initial page load
- User/member/site data available immediately (no loading states)

## Phase 1: Pagination (Biggest Win) 🎯

**Goal**: Reduce initial API calls from ~50 to ~10 (5x improvement)
**Expected load time**: ~7 seconds (5x faster than 35s)

### Backend Changes
- [ ] Update `GalleryPhotoRepository.listBySite()` to accept `{ limit, offset }` options
- [ ] Update `AnniversaryOccurrenceRepository.listBySite()` to accept `{ limit, offset }` options
- [ ] Modify `/api/pictures` endpoint to:
  - Accept `limit` query param (default: 10)
  - Accept `offset` query param (default: 0)
  - Return total count for pagination UI

### Frontend Changes
- [ ] Uncomment feed content in `/app/page.tsx`
- [ ] Update `loadFeed()` to accept pagination params
- [ ] Load initial batch (10 items) on mount
- [ ] Implement infinite scroll:
  - Detect when user scrolls near bottom (e.g., 80% scrolled)
  - Load next batch (10 more items)
  - Append to existing feed
  - Show loading indicator
- [ ] Only fetch likes for currently loaded items (not all at once)
- [ ] Handle empty state and end of feed

## Phase 2: Image Optimization 📸

**Goal**: Reduce image bandwidth by ~70%
**Expected improvement**: Faster rendering, less network congestion

### Backend Investigation
- [ ] Check if images are being resized/optimized for mobile
- [ ] Verify Firebase Storage is serving appropriate sizes
- [ ] Consider creating thumbnail versions (e.g., 400px wide for mobile feed)
- [ ] Update `ImageStore.uploadGalleryPhoto()` to create multiple sizes if needed:
  - Thumbnail: 400px (for feed)
  - Medium: 800px (for lightbox on mobile)
  - Full: 1600px (for desktop)

### Frontend Verification
- [ ] Verify CSS properly hides desktop-size images on mobile
- [ ] Ensure mobile only loads mobile-optimized versions
- [ ] Check `ShimmerImage` component isn't loading full-res unnecessarily
- [ ] Use `<picture>` element with srcset for responsive images

## Phase 3: Testing & Validation ✅

- [ ] Test with 3G throttling, cache disabled (current test environment)
- [ ] Measure load time after Phase 1 implementation
- [ ] Measure load time after Phase 2 implementation
- [ ] Verify smooth infinite scroll UX (no jank)
- [ ] Test on actual mobile device (iOS/Android)
- [ ] Test with cache enabled (production scenario)

## Success Criteria 🎉

- **Primary Goal**: < 10 seconds (with 3G throttling, cache disabled)
- **Stretch Goal**: < 7 seconds
- Smooth scroll experience with no UI jank
- Progressive loading feels natural to users
- No regression in features or UX

## Implementation Notes

- Start with Phase 1 (pagination) - biggest ROI
- Phase 2 can be done in parallel or after Phase 1
- Keep original code commented for easy rollback if needed
- Consider adding performance metrics logging