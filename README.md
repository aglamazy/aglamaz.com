# FamCircle

**FamCircle** is a private family website platform that brings your family together in one beautiful, secure space. Share memories, celebrate milestones, and stay connected with the people who matter most.

## What is FamCircle?

FamCircle helps families create their own private website where they can:
- **Share Stories** - Write and publish family blog posts with rich text and photos
- **Celebrate Together** - Create blessing pages for birthdays, anniversaries, and special occasions
- **Remember Important Dates** - Keep track of family anniversaries and events in a shared calendar
- **Preserve Memories** - Upload and organize family photos in shared galleries

Built with modern web technologies (Next.js, Firebase, Firestore) and designed for families who value privacy and connection.

### Google Search Console verification

To verify the site with Google Search Console using a meta tag, set the environment variable with your verification token:

```
GOOGLE_SITE_VERIFICATION=<The tag>
```

The app exposes this value via Next.js metadata in `src/app/layout.tsx`. Do not hardcode verification tokens in source; use env vars instead. Alternatively, DNS verification (Domain property) is recommended for broader coverage.

## Features

- App Router with server components
- Tailwind CSS styling
- Google and Facebook sign-in using Firebase Authentication
- Middleware protection for routes under `/private`
- Server-side token verification using Firebase Admin SDK
- Public routes allow anonymous access, but if a request includes an access token the middleware validates and refreshes it to keep the session alive

# The blog
The blog feature allows a user to start a blog.

## Blog Registration Flow
Before a member can write blog posts, they must register their blog.

### First-Time Flow
1. User clicks "New Post" for the first time
2. System checks: Does user have `blogEnabled` and `blogHandle`?
3. If NO → Modal opens to collect blog settings:
   - **Blog Slug** (required): Suggested from user's email (e.g., "yaakov.aglamaz@gmail.com" → "yaakov-aglamaz")
   - User can edit the suggested slug before saving
   - System validates uniqueness within the site (adds numeric suffix if taken: "agla-2")
   - **Note**: Once saved, the slug cannot be changed
4. If YES → Proceed to post creation

### Member Fields
- `blogEnabled` (boolean): Whether the member has registered their blog
- `blogHandle` (string): Unique slug used in blog URLs (e.g., `/blog/agla`)

### Implementation
- **Repository**: `MemberRepository.setBlogEnabled(uid, siteId, enabled)` - Enables blog and sets handle
- **Repository**: `MemberRepository.generateUniqueBlogHandle(base, siteId)` - Ensures handle uniqueness within site
- **Repository**: `MemberRepository.getByBlogHandle(siteId, handle)` - Finds member by blog handle

## Scope
### /app/blog
Family blog: All the posts of all the authors in the site are visible in the family blog. (Filtering by topic will be added later)
### /[locale]/blog
Public family blog: The posts that were marked as public, will be visible to visitors (no login required for now).
### /[locale]/blog/[handle]
Author blog: Single author's blog facing public. The `[handle]` parameter is the member's `blogHandle` field.

# Blessing Pages

The blessing pages feature allows family members to create and share blessings for anniversary events (birthdays, weddings, etc.).

## Overview
- Create a blessing page for any anniversary event by year
- Members can add, edit, and delete their blessings
- Rich text editor with celebration emojis (🎂🥳🎊🍷🎁🕯️❤️💙)
- Inline photo upload support
- Permission system: authors can edit their own blessings, admins can edit all

## User Flow
1. From the calendar, click on an anniversary event
2. Click "Create Blessing Page" button (one per event per year)
3. Share the blessing page URL with family members
4. Members can add blessings using the floating action button (FAB)
5. Edit/delete buttons appear on blessings for authors and admins

## Data Structure
- **BlessingPage**: Page metadata (eventId, year, slug, siteId)
- **Blessing**: Individual blessing messages (blessingPageId, authorId, content HTML)
- Top-level collections for query flexibility

## Implementation
- **Entities**: `BlessingPage`, `Blessing`
- **Repositories**: `BlessingPageRepository`, `BlessingRepository`
- **API Routes**:
  - `POST/GET /api/anniversaries/[id]/blessing-pages` - Create/list blessing pages
  - `GET /api/blessing-pages/by-slug/[slug]` - Fetch page with event details
  - `POST/GET /api/blessing-pages/[id]/blessings` - Create/list blessings
  - `PUT/DELETE /api/blessing-pages/[id]/blessings/[blessingId]` - Edit/delete blessings
- **Pages**: `/app/blessing/[slug]` - View and manage blessings

## Rich Text Editor
- TinyMCE integration via `EditorRich` component
- Context-specific emojis passed as props
- Inline image upload (currently base64, optimization pending)
- Delete functionality built into editor

## Future Enhancements
- Replace base64 image storage with Firebase Storage (see TODO.md)
- Add reactions/likes to blessings
- Link event owner to member profile

# Architecture

See detailed architecture documentation in `docs/architecture.md`:
- Repository Pattern for database access
- Localization implementation and storage format
- JIT (Just-In-Time) translation