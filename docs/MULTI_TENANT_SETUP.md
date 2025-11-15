# Multi-Tenant Setup Guide

This guide explains how to run a single deployment serving multiple sites based on domain/subdomain.

## Architecture Overview

The system uses **secure domain mapping** to prevent site ID guessing:

### Site Resolution Flow (Priority Order)

1. **Domain Mapping Lookup**: Query Firebase `domainMappings/{domain}` collection
2. **Environment Variable Fallback**: Use `NEXT_SITE_ID` if set (temporary, will be removed)
3. **Under Construction**: Show error page if no configuration exists

### Security Benefits

- Site document IDs are **private** (auto-generated, hard to guess: `XFptrxZIKXV6P2TjtGCL`)
- Public domains map to private IDs via `domainMappings` collection
- No way to enumerate or guess site IDs from URLs

## Firebase Structure

### Domain Mappings Collection

Maps public domains to private site IDs:

```
domainMappings/
  aglamaz.com:
    siteId: "XFptrxZIKXV6P2TjtGCL"
  levi.famcircle.org:
    siteId: "AbC123XyZ456PqRsTuV"
  cohen.famcircle.org:
    siteId: "DeF789GhI012JkLmNoP"
```

### Sites Collection

Each site has a document with an auto-generated ID:

```
sites/
  XFptrxZIKXV6P2TjtGCL/:
    name: "Aglamaz Family"
    ownerUid: "..."
    ...
  AbC123XyZ456PqRsTuV/:
    name: "Levi Family"
    ownerUid: "..."
    ...
```

## Adding a New Site

### Step 1: Create Site Document

In Firebase Console, create a new document in the `sites` collection with an **auto-generated ID**:

```
Collection: sites
Document ID: [Auto-generated, e.g., "XFptrxZIKXV6P2TjtGCL"]
Fields:
  - name: "Family Name"
  - ownerUid: "user-uid-here"
  - createdAt: [Timestamp]
  - updatedAt: [Timestamp]
```

### Step 2: Create Domain Mapping

In Firebase Console, create a mapping in the `domainMappings` collection:

```
Collection: domainMappings
Document ID: "subdomain.famcircle.org" (exact domain)
Fields:
  - siteId: "XFptrxZIKXV6P2TjtGCL" (the auto-generated ID from Step 1)
```

**Example:**
```
Document ID: levi.famcircle.org
Field: siteId = "XFptrxZIKXV6P2TjtGCL"
```

### Step 3: Configure DNS (Production Only)

- For `*.famcircle.org`: Ensure wildcard DNS points to Vercel
- For custom domains: Add to Vercel and create mapping

## Local Development

### Option 1: Query Parameter Override (Easiest)

Visit different sites using the `?site=` query parameter with the **actual site document ID**:

```bash
# Test specific site by document ID
http://localhost:3000?site=XFptrxZIKXV6P2TjtGCL

# Use default (falls back to domain mapping, then NEXT_SITE_ID)
http://localhost:3000
```

### Option 2: /etc/hosts Mapping (With Firebase Setup)

Edit `/etc/hosts` to map custom domains to localhost:

```bash
sudo nano /etc/hosts
```

Add these lines:

```
127.0.0.1  levi.famcircle.local
127.0.0.1  aglamaz.local
```

**Important**: You must also create the domain mapping in Firebase:

```
domainMappings/levi.famcircle.local:
  siteId: "XFptrxZIKXV6P2TjtGCL"
```

Then visit:
- `http://levi.famcircle.local:3000` (looks up mapping in Firebase)
- `http://aglamaz.local:3000` (looks up mapping in Firebase)
- `http://localhost:3000` (falls back to NEXT_SITE_ID env variable)

### Option 3: Docker Compose with Multiple Ports

Run multiple instances with different environment variables:

```yaml
version: '3.8'
services:
  aglamaz:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_SITE_ID=aglamaz

  levi:
    build: .
    ports:
      - "3001:3000"
    environment:
      - NEXT_SITE_ID=levi

  cohen:
    build: .
    ports:
      - "3002:3000"
    environment:
      - NEXT_SITE_ID=cohen
```

## Vercel Deployment

### Single Deployment, Multiple Domains

1. **Configure domains in Vercel**:
   - Add `aglamaz.com`
   - Add `*.famcircle.org` (wildcard subdomain)
   - Add any custom domains as needed

2. **Environment Variables**:
   - Set `NEXT_SITE_ID` to your default/fallback site ID (temporary, will be removed later)
   - This catches unmapped domains and provides graceful degradation

3. **Firebase Setup**:
   - Create domain mapping for each domain in `domainMappings` collection
   - Use auto-generated site IDs for security

4. **DNS Configuration**:
   - Point `*.famcircle.org` to Vercel
   - Point custom domains (like `aglamaz.com`) to Vercel

## Cache Invalidation

When content is updated, invalidate the appropriate cache:

```typescript
import { revalidateTag } from 'next/cache';

// Invalidate specific site by ID
revalidateTag('site-XFptrxZIKXV6P2TjtGCL');

// Invalidate all sites
revalidateTag('site-info');

// Invalidate specific domain mapping
revalidateTag('domain-levi.famcircle.org');

// Invalidate all domain mappings
revalidateTag('domain-mappings');

// Invalidate platform description
revalidateTag('platform-description');
```

## How It Works

### Request Flow

```
Request: aglamaz.com
  ↓
resolveSiteId() → fetchSiteIdByDomain("aglamaz.com")
  ↓
Firebase: domainMappings/aglamaz.com → { siteId: "XFptrxZIKXV6P2TjtGCL" }
  ↓
fetchSiteInfo("XFptrxZIKXV6P2TjtGCL") → Firebase sites/XFptrxZIKXV6P2TjtGCL
  ↓
Cache: site-info-XFptrxZIKXV6P2TjtGCL (isolated per site)
  ↓
Render landing page with site data
```

### Example Scenarios

**Scenario 1: Mapped Domain (Production)**
```
Request: aglamaz.com
→ Domain mapping found: "XFptrxZIKXV6P2TjtGCL"
→ Load site data
→ Render: "Welcome to Aglamaz Family"
```

**Scenario 2: Unmapped Domain with Fallback**
```
Request: demo.famcircle.org
→ No domain mapping found
→ Fall back to NEXT_SITE_ID env variable
→ Load default site
→ Render with default site data
```

**Scenario 3: No Configuration**
```
Request: unknown.famcircle.org
→ No domain mapping found
→ NEXT_SITE_ID not set
→ Return null
→ Render: "Under Construction" page
```

**Scenario 4: Local Development with Override**
```
Request: localhost:3000?site=XFptrxZIKXV6P2TjtGCL
→ Query parameter override detected
→ Skip domain lookup
→ Load site directly by ID
→ Render with specified site data
```

## Testing Strategy

1. **Local development**: Use `?site=` query parameter
2. **Staging**: Use separate Vercel preview deployments
3. **Production**: Configure actual domains

## Troubleshooting

### "Under Construction" page showing unexpectedly

**Possible causes:**
1. Domain mapping doesn't exist in Firebase `domainMappings` collection
2. `NEXT_SITE_ID` environment variable not set
3. Domain mapping points to non-existent site ID

**Solution:**
- Create domain mapping in Firebase Console
- Or set `NEXT_SITE_ID` as temporary fallback
- Use `?site=SITE_ID` query parameter for testing

### Different sites showing same content

**Possible causes:**
- Multiple domains mapped to same siteId
- Cache not cleared after changing mappings

**Solution:**
- Verify each domain has unique siteId in `domainMappings`
- Clear Next.js cache: `rm -rf .next`
- Call `revalidateTag('domain-mappings')` after changes

### Can't access site with custom domain

**Checklist:**
1. ✅ Domain added in Vercel dashboard
2. ✅ DNS points to Vercel
3. ✅ Domain mapping exists in Firebase `domainMappings/{domain}`
4. ✅ Mapped siteId exists in Firebase `sites/{siteId}`

### Performance Considerations

- Each site has isolated cache (per siteId)
- Domain mappings are cached (per domain)
- Cache survives cold starts on Vercel
- Revalidates every hour (configurable)
- First request after revalidation may be slower
