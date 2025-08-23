# Aglamaz App

This is a minimal Next.js 14 application demonstrating Firebase Authentication with Google and Facebook providers. Authenticated routes are protected using middleware that verifies Firebase ID tokens with the Firebase Admin SDK.

## Development

1. Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials.
2. Install dependencies with `npm install` (requires internet access).
3. Run the development server using `npm run dev`.

## Features

- App Router with server components
- Tailwind CSS styling
- Google and Facebook sign-in using Firebase Authentication
- Middleware protection for routes under `/private`
- Server-side token verification using Firebase Admin SDK
- Public routes allow anonymous access, but if a request includes an access token the middleware validates and refreshes it to keep the session alive
