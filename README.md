# Aglamaz App

This is a minimal Next.js 14 application demonstrating Firebase Authentication with Google and Facebook providers. Authenticated routes are protected using middleware that verifies Firebase ID tokens with the Firebase Admin SDK.

## Development

1. Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials.
2. Install dependencies with `npm install` (requires internet access).
3. Run the development server using `npm run dev`.

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

# Architecture

See detailed architecture documentation in `docs/architecture.md`:
- Repository Pattern for database access
- Localization implementation and storage format
- JIT (Just-In-Time) translation