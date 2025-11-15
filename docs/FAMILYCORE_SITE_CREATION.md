# FamilyCore - Site Creation Instructions

## Overview

This document explains what the **FamilyCore backoffice** (super admin panel) needs to do when creating a new family site.

## When Super Admin Creates a New Site

### Step 1: Create Site Document in Firebase

Create a new document in the `sites` collection with an **auto-generated ID** (do NOT use a custom ID):

```typescript
// Firebase Firestore
const sitesCollection = db.collection('sites');

// Let Firebase auto-generate the ID for security
const newSiteRef = sitesCollection.doc(); // No parameter = auto-generated ID
const siteId = newSiteRef.id; // This will be something like "XFptrxZIKXV6P2TjtGCL"

await newSiteRef.set({
  name: "Family Name", // e.g., "Levi Family", "Cohen Family"
  ownerUid: "user-firebase-uid", // The UID of the family admin/owner
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),

  // Optional fields:
  translations: {}, // Will be populated by the frontend
  aboutFamily: "", // Optional family description
  sourceLang: "he", // Default source language
  aboutTranslations: {}, // Will be populated by the frontend
});
```

**Important:**
- ✅ **DO**: Let Firebase auto-generate the document ID
- ❌ **DON'T**: Use predictable IDs like "levi", "cohen", or user input
- ❌ **DON'T**: Use sequential numbers or easily guessable patterns

**Why?** Auto-generated IDs prevent unauthorized access by making site IDs impossible to guess.

---

### Step 2: Create Domain Mapping(s)

**Important:** A site can have **multiple domains** pointing to it. Create one mapping per domain.

```typescript
// Firebase Firestore
const domainMappingsCollection = db.collection('domainMappings');

// Create mapping for primary domain
await domainMappingsCollection.doc('levi.famcircle.org').set({
  siteId: siteId, // The auto-generated ID from Step 1
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  isPrimary: true, // Mark as primary domain (optional)
  createdBy: "super-admin-uid",
});

// (Optional) Create additional domain mappings for the same site
await domainMappingsCollection.doc('levifamily.com').set({
  siteId: siteId, // Same siteId - points to same site
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  isPrimary: false, // This is an alias/secondary domain
  createdBy: "super-admin-uid",
});

await domainMappingsCollection.doc('www.levifamily.com').set({
  siteId: siteId, // Same siteId - points to same site
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  isPrimary: false,
  createdBy: "super-admin-uid",
});
```

**Examples of domain mappings:**

```typescript
// Site 1: Levi Family (multiple domains for same site)
domainMappings/levi.famcircle.org → { siteId: "XFptrxZIKXV6P2TjtGCL", isPrimary: true }
domainMappings/levifamily.com → { siteId: "XFptrxZIKXV6P2TjtGCL", isPrimary: false }
domainMappings/www.levifamily.com → { siteId: "XFptrxZIKXV6P2TjtGCL", isPrimary: false }

// Site 2: Cohen Family (single domain)
domainMappings/cohen.famcircle.org → { siteId: "AbC123XyZ456PqRsTuV", isPrimary: true }

// Site 3: Aglamaz (custom domain)
domainMappings/aglamaz.com → { siteId: "DeF789GhI012JkLmNoP", isPrimary: true }
domainMappings/www.aglamaz.com → { siteId: "DeF789GhI012JkLmNoP", isPrimary: false }

// Local testing
domainMappings/levi.famcircle.local → { siteId: "XFptrxZIKXV6P2TjtGCL" }
```

**Document ID Rules:**
- Use the **exact domain** including subdomain and TLD
- Include port for local testing (e.g., `localhost:3000`) if needed
- Lowercase only (domains are case-insensitive)
- No trailing slashes or paths

---

### Step 3: (Optional) Invalidate Cache

If the frontend is already deployed and you want the new mapping to be immediately available, call the cache invalidation API:

```typescript
// Call the frontend API (if you implement this endpoint)
await fetch('https://famcircle.org/api/cache/revalidate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${superAdminToken}`, // Secure this!
  },
  body: JSON.stringify({
    tags: ['domain-mappings', `domain-${domain}`],
  }),
});
```

**Note:** Without this, the new domain mapping will be cached within an hour automatically.

---

## Complete Example

Here's a complete example function for the FamilyCore backoffice:

```typescript
interface CreateSiteInput {
  familyName: string;
  ownerUid: string;
  domains?: string[]; // Optional: e.g., ["levi.famcircle.org", "levifamily.com"]
  primaryDomain?: string; // Optional: which domain is primary
  sourceLang?: string; // Optional: default "he"
}

interface CreateSiteResult {
  siteId: string;
  domains: string[];
  primaryDomain?: string;
}

async function createNewSite(
  input: CreateSiteInput
): Promise<CreateSiteResult> {
  const { familyName, ownerUid, domains = [], primaryDomain, sourceLang = 'he' } = input;

  // Step 1: Create site document with auto-generated ID
  const sitesCollection = db.collection('sites');
  const newSiteRef = sitesCollection.doc(); // Auto-generate ID
  const siteId = newSiteRef.id;

  await newSiteRef.set({
    name: familyName,
    ownerUid: ownerUid,
    sourceLang: sourceLang,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    translations: {},
    aboutFamily: '',
    aboutTranslations: {},
  });

  console.log(`✅ Created site document: sites/${siteId}`);

  // Step 2: Create domain mappings (if domains provided)
  const mappingsCollection = db.collection('domainMappings');
  const createdDomains: string[] = [];

  for (const domain of domains) {
    const normalizedDomain = domain.toLowerCase().trim();

    // Check if domain is already taken
    const existingMapping = await mappingsCollection.doc(normalizedDomain).get();
    if (existingMapping.exists) {
      console.error(`❌ Domain ${normalizedDomain} is already taken`);
      throw new Error(`Domain ${normalizedDomain} is already assigned to another site`);
    }

    // Create the mapping
    await mappingsCollection.doc(normalizedDomain).set({
      siteId: siteId,
      isPrimary: normalizedDomain === (primaryDomain || domains[0])?.toLowerCase().trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    createdDomains.push(normalizedDomain);
    console.log(`✅ Created domain mapping: ${normalizedDomain} → ${siteId}`);
  }

  // Step 3: (Optional) Invalidate cache
  // TODO: Implement cache invalidation API call if needed

  return {
    siteId: siteId,
    domains: createdDomains,
    primaryDomain: primaryDomain || createdDomains[0],
  };
}
```

---

## Validation Rules

### Before Creating a Site:

1. **Check domain availability for ALL domains:**
   ```typescript
   const domainsToCheck = ["levi.famcircle.org", "levifamily.com"];

   for (const domain of domainsToCheck) {
     const existingMapping = await db.collection('domainMappings')
       .doc(domain)
       .get();

     if (existingMapping.exists) {
       throw new Error(`Domain ${domain} is already assigned to another site`);
     }
   }
   ```

2. **Validate domain format:**
   - Must be a valid domain/subdomain
   - For `*.famcircle.org`: subdomain must be alphanumeric + hyphens only
   - No spaces, special characters (except hyphens and dots)

3. **Verify owner exists:**
   ```typescript
   const ownerUser = await admin.auth().getUser(ownerUid);
   if (!ownerUser) {
     throw new Error(`Owner user ${ownerUid} does not exist`);
   }
   ```

---

## Error Handling

```typescript
// Example 1: Create site with single domain
try {
  const result = await createNewSite({
    familyName: "Levi Family",
    ownerUid: "abc123",
    domains: ["levi.famcircle.org"],
  });

  console.log('Site created successfully:', result);
  // Output: { siteId: "XFptrxZIKXV6P2TjtGCL", domains: ["levi.famcircle.org"], primaryDomain: "levi.famcircle.org" }
} catch (error) {
  console.error('Failed to create site:', error);
}

// Example 2: Create site with multiple domains
try {
  const result = await createNewSite({
    familyName: "Levi Family",
    ownerUid: "abc123",
    domains: [
      "levi.famcircle.org",
      "levifamily.com",
      "www.levifamily.com"
    ],
    primaryDomain: "levifamily.com", // Specify which is primary
  });

  console.log('Site created successfully:', result);
  // Output: {
  //   siteId: "XFptrxZIKXV6P2TjtGCL",
  //   domains: ["levi.famcircle.org", "levifamily.com", "www.levifamily.com"],
  //   primaryDomain: "levifamily.com"
  // }
} catch (error) {
  if (error.message.includes('already assigned')) {
    // Domain is already taken by another site
    console.error('One of the domains is already in use');
  } else {
    // Other errors
    console.error('Failed to create site:', error);
  }
}
```

---

## Adding Additional Domains to Existing Site

To add more domains to an existing site later:

```typescript
async function addDomainToSite(siteId: string, newDomain: string) {
  const normalizedDomain = newDomain.toLowerCase().trim();

  // Check if domain is available
  const existingMapping = await db.collection('domainMappings')
    .doc(normalizedDomain)
    .get();

  if (existingMapping.exists) {
    throw new Error(`Domain ${normalizedDomain} is already taken`);
  }

  // Verify site exists
  const siteDoc = await db.collection('sites').doc(siteId).get();
  if (!siteDoc.exists) {
    throw new Error(`Site ${siteId} does not exist`);
  }

  // Create new mapping
  await db.collection('domainMappings').doc(normalizedDomain).set({
    siteId: siteId,
    isPrimary: false, // New domains are not primary by default
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Added domain ${normalizedDomain} to site ${siteId}`);
}

// Usage
await addDomainToSite("XFptrxZIKXV6P2TjtGCL", "levifamily.co.il");
```

## Removing a Domain from a Site

```typescript
async function removeDomainFromSite(domain: string) {
  const normalizedDomain = domain.toLowerCase().trim();

  // Check if mapping exists
  const mappingDoc = await db.collection('domainMappings')
    .doc(normalizedDomain)
    .get();

  if (!mappingDoc.exists) {
    throw new Error(`Domain ${normalizedDomain} is not mapped to any site`);
  }

  // Check if it's the last domain for the site (optional warning)
  const siteId = mappingDoc.data()?.siteId;
  const otherMappings = await db.collection('domainMappings')
    .where('siteId', '==', siteId)
    .get();

  if (otherMappings.size === 1) {
    console.warn(`⚠️ Warning: Removing the last domain for site ${siteId}`);
  }

  // Delete the mapping
  await db.collection('domainMappings').doc(normalizedDomain).delete();

  console.log(`✅ Removed domain ${normalizedDomain}`);
}

// Usage
await removeDomainFromSite("old-domain.famcircle.org");
```

## Testing Checklist

After implementing, test these scenarios:

- [ ] Create site without domains (should work)
- [ ] Create site with single domain (should work)
- [ ] Create site with multiple domains (should work, all domains work)
- [ ] Try to create site with existing domain (should fail)
- [ ] Verify all domains for a site load the same content
- [ ] Add domain to existing site (should work)
- [ ] Remove domain from site (should work)
- [ ] Try to use removed domain (should show "Under Construction")
- [ ] Verify auto-generated siteId is unpredictable
- [ ] Verify site data is properly isolated from other sites

---

## Security Notes

1. **Auto-generated IDs are critical** - Never let users choose or see site IDs
2. **Domain mappings are public** - Store no sensitive data in them
3. **Validate super admin permissions** - Only super admins should create sites
4. **Rate limit** - Prevent abuse of site creation
5. **Audit logs** - Track who created which site and when

---

## Use Cases for Multiple Domains

### Common Scenarios:

1. **Brand Migration:**
   ```
   // Old brand → New brand
   oldname.famcircle.org → site123
   newname.famcircle.org → site123
   ```

2. **Custom Domain + Default Subdomain:**
   ```
   levi.famcircle.org → site123 (provided by platform)
   levifamily.com → site123 (custom domain owned by family)
   ```

3. **WWW and Non-WWW:**
   ```
   levifamily.com → site123
   www.levifamily.com → site123
   ```

4. **Multiple TLDs (International):**
   ```
   levifamily.com → site123 (US)
   levifamily.co.il → site123 (Israel)
   levifamily.fr → site123 (France)
   ```

5. **Testing + Production:**
   ```
   levi.famcircle.org → site123 (production)
   levi-staging.famcircle.org → site123 (same site, different domain for testing)
   ```

## Future Enhancements

Consider adding these fields to site documents:

```typescript
{
  // Existing fields...

  // Domain management
  primaryDomain: "levifamily.com", // Store primary domain in site doc (optional)

  // Subscription/billing
  subscriptionStatus: "active" | "suspended" | "cancelled",
  subscriptionTier: "free" | "premium" | "enterprise",
  billingEmail: "owner@example.com",

  // Limits
  maxMembers: 100,
  maxStorage: 5368709120, // 5GB in bytes
  maxDomains: 3, // Limit number of domains per site

  // Custom branding
  customLogo: "https://storage.../logo.png",
  primaryColor: "#2D5F4D",

  // Status
  isActive: true,
  isSuspended: false,
  suspensionReason: null,
}
```

---

## Questions?

If you have questions about this implementation, contact the frontend team or refer to:
- `docs/MULTI_TENANT_SETUP.md` - Frontend multi-tenant architecture
- `src/utils/resolveSiteId.ts` - Site resolution logic
- `src/firebase/admin.ts` - Firebase integration
