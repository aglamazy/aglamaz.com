# TypeScript Interfaces Index - Aglamaz Project

## Authentication & User Interfaces

### JwtRegisteredClaims
**File:** `/src/auth/tokens.ts`
**Description:** JWT standard registered claims (iss, sub, aud, exp, nbf, iat, jti)
**Key Properties:** iss, sub, aud, exp, nbf, iat, jti

### AppClaims
**File:** `/src/auth/tokens.ts`
**Description:** Application-specific JWT claims containing user and authorization info
**Key Properties:** userId, siteId, role, firstName, lastName, email, needsCredentialSetup

### TokenClaims
**File:** `/src/auth/tokens.ts`
**Description:** Combined JWT and app claims - the complete token payload
**Key Properties:** (extends JwtRegisteredClaims & AppClaims)

### IUser
**File:** `/src/entities/User.ts`
**Description:** User authentication profile from auth provider
**Key Properties:** email, email_verified, name, picture, user_id, needsCredentialSetup

### MemberDoc
**File:** `/src/entities/firebase/MemberDoc.ts` and `/src/app/api/types.ts`
**Description:** Minimal member document from Firestore (uid, siteId, role)
**Key Properties:** uid, siteId, role

### IMember
**File:** `/src/entities/Member.ts`
**Description:** Complete member profile with personal info and settings
**Key Properties:** id, displayName, uid, siteId, role, firstName, email, blogEnabled, blogHandle, blogTermsAcceptedAt, siteTermsAcceptedAt, defaultLocale, avatarUrl, avatarStoragePath, createdAt, updatedAt

### MemberRecord
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Extended member record with approval/rejection tracking from repository
**Key Properties:** id, displayName, uid, siteId, role, lastName, approvedAt, approvedBy, rejectedAt, rejectedBy, rejectionReason, userId, blogHandle, blogEnabled, avatarUrl, avatarStoragePath, translations

### LocalizedMemberRecord
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Member record with localized display names
**Key Properties:** (extends MemberRecord + displayNameLocalized, firstNameLocalized)

### MemberLocaleProfile
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Localized member profile translations
**Key Properties:** displayName, firstName

---

## Entity Interfaces

### AnniversaryEvent
**File:** `/src/entities/Anniversary.ts`
**Description:** Anniversary or life event (birthday, death, wedding) with optional Hebrew date support
**Key Properties:** id, siteId, ownerId, name, description, type, date, month, day, year, isAnnual, useHebrew, hebrewDate, hebrewKey, hebrewOccurrences, imageUrl, createdAt, blessingPages, locales

### AnniversaryOccurrence
**File:** `/src/repositories/AnniversaryOccurrenceRepository.ts`
**Description:** Individual occurrence of an anniversary with images and description
**Key Properties:** id, siteId, eventId, date, createdAt, createdBy, images, locales

### Blessing
**File:** `/src/entities/Blessing.ts`
**Description:** A blessing message written on a blessing page for an anniversary
**Key Properties:** id, blessingPageId, siteId, authorId, authorName, content, createdAt, updatedAt, deleted, deletedAt, locales

### BlessingPage
**File:** `/src/entities/BlessingPage.ts`
**Description:** Blessing page for a specific anniversary year (collection of blessings)
**Key Properties:** id, eventId, siteId, year, slug, createdBy, createdAt

### IBlogPost
**File:** `/src/entities/BlogPost.ts`
**Description:** Blog post with multi-locale support and translation metadata
**Key Properties:** id, authorId, siteId, primaryLocale, locales, translationMeta, isPublic, likeCount, shareCount, deletedAt, createdAt, updatedAt

### BlogPostLocale
**File:** `/src/entities/BlogPost.ts`
**Description:** Localized content for a single blog post locale
**Key Properties:** title, title$meta, content, content$meta, seoTitle, seoTitle$meta, seoDescription, seoDescription$meta

### BlogPostLocaleFieldMeta
**File:** `/src/entities/BlogPost.ts`
**Description:** Metadata about a localized blog field (translation engine and timestamp)
**Key Properties:** updatedAt, engine, sourceLocale

### BlogPostLocalizedFields
**File:** `/src/entities/BlogPost.ts`
**Description:** Resolved localized fields with fallback chain for a specific locale
**Key Properties:** locale, title, content, seoTitle, seoDescription, fallbackChain

### LocalizedBlogPost
**File:** `/src/entities/BlogPost.ts`
**Description:** Blog post with localized fields resolved for viewing
**Key Properties:** post, localized

### BlogPostLocaleUpsertPayload
**File:** `/src/entities/BlogPost.ts`
**Description:** Payload for updating blog post localized fields
**Key Properties:** title, content, seoTitle, seoDescription, engine, sourceLocale

### GalleryPhoto
**File:** `/src/repositories/GalleryPhotoRepository.ts`
**Description:** Gallery photo set with multiple images and metadata
**Key Properties:** id, siteId, createdBy, createdAt, date, images, anniversaryId, deletedAt, locales

### ISite
**File:** `/src/entities/Site.ts`
**Description:** Family site with multi-locale content
**Key Properties:** id, ownerUid, createdAt, updatedAt, name, aboutFamily, platformName, locales

### SiteLocaleContent
**File:** `/src/entities/Site.ts`
**Description:** Localized content for a site
**Key Properties:** name, name$meta, aboutFamily, aboutFamily$meta, platformName, platformName$meta

### IContactMessage
**File:** `/src/entities/ContactMessage.ts`
**Description:** Contact form message
**Key Properties:** id, name, email, message, createdAt

---

## API & Request/Response Interfaces

### RouteParams
**File:** `/src/app/api/types.ts`
**Description:** Common route parameters for API endpoints
**Key Properties:** siteId, id, token, eventId, memberId

### GuardContext
**File:** `/src/app/api/types.ts`
**Description:** Context passed to guarded route handlers
**Key Properties:** params, user, member

### RouteHandler
**File:** `/src/app/api/types.ts`
**Description:** Type for guarded route handler functions
**Signature:** (request: Request, context: GuardContext) => Response | Promise<Response>

### SignupRequest
**File:** `/src/repositories/FamilyRepository.ts`
**Description:** Signup request record tracking membership application
**Key Properties:** id, firstName, email, siteId, userId, status, verificationToken, expiresAt, email_verified, createdAt, updatedAt, verifiedAt, approvedAt, approvedBy, rejectedAt, rejectedBy, rejectionReason, source, inviteToken, invitationId, invitedBy, invitedAt, language

### SiteInvite
**File:** `/src/repositories/FamilyRepository.ts`
**Description:** Invitation token for joining a site
**Key Properties:** id, token, siteId, inviterId, inviterEmail, inviterName, status, createdAt, updatedAt, expiresAt, usedAt, usedBy, usedByEmail

### EmailData
**File:** `/src/services/GmailService.ts`
**Description:** Email payload for sending via Gmail
**Key Properties:** to, subject, html, text

### EmailTemplateOptions
**File:** `/src/services/emailTemplates.ts`
**Description:** Configuration for rendering email templates
**Key Properties:** subject, lang, dir, heading, preheader, greeting, paragraphs, button, note, secondary, linkList, footerLines

### EmailButton
**File:** `/src/services/emailTemplates.ts`
**Description:** CTA button in email template
**Key Properties:** label, url

### EmailNote
**File:** `/src/services/emailTemplates.ts`
**Description:** Note/highlight box in email template
**Key Properties:** title, lines

---

## Component Props Interfaces

### ModalProps
**File:** `/src/components/ui/Modal.tsx`
**Description:** Modal dialog component props
**Key Properties:** isOpen, onClose, children, isClosable

### ImageGridProps
**File:** `/src/components/media/ImageGrid.tsx`
**Description:** Image grid gallery component props
**Key Properties:** items, getMeta, onToggle, onTitleClick

### GridItem
**File:** `/src/components/media/ImageGrid.tsx`
**Description:** Single gallery image item
**Key Properties:** key, src, title, meta, dir

### LikeMeta
**File:** `/src/components/media/ImageGrid.tsx`
**Description:** Like information for a gallery image
**Key Properties:** count, likedByMe, likers

### LikersPopoverProps
**File:** `/src/components/photos/LikersPopover.tsx`
**Description:** Popover showing who liked a photo
**Key Properties:** likers, onClose, onNavigateProfile, title, emptyLabel, dir, language, anchorEl

### GalleryPhotoEditModalProps
**File:** `/src/components/photos/GalleryPhotoEditModal.tsx`
**Description:** Modal for editing gallery photo
**Key Properties:** photoId, isOpen, onClose, onUpdated, initialPhoto

### GalleryPhotoForEdit
**File:** `/src/components/photos/GalleryPhotoEditModal.tsx`
**Description:** Gallery photo data for editing
**Key Properties:** id, date, description, images

### PhotoUploadModalProps
**File:** `/src/components/photos/PhotoUploadModal.tsx`
**Description:** Modal for uploading gallery photos
**Key Properties:** isOpen, onClose, onSuccess

### OccurrenceEditModalProps
**File:** `/src/components/anniversaries/OccurrenceEditModal.tsx`
**Description:** Modal for editing anniversary occurrence
**Key Properties:** anniversaryId, occurrenceId, isOpen, onClose, onUpdated, initialOccurrence

### OccurrenceForEdit
**File:** `/src/components/anniversaries/OccurrenceEditModal.tsx`
**Description:** Anniversary occurrence data for editing
**Key Properties:** id, eventId, date, description, images

### BlogSetupModalProps
**File:** `/src/components/blog/BlogSetupModal.tsx`
**Description:** Modal for setting up blog
**Key Properties:** open, onClose, onSuccess

---

## Repository Interfaces

### MemberQueryOptions
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Options for member queries
**Key Properties:** locale

### MemberListOptions
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Options for listing members
**Key Properties:** locale, roles, orderBy, limit, blogEnabled, blogHandle

### MemberTransactionSnapshot
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Member snapshot from transaction
**Key Properties:** id, data

### SiteConfigDoc
**File:** `/src/repositories/ConfigRepository.ts`
**Description:** Site configuration document
**Key Properties:** hebHorizonYear, siteNameTranslations

### ImageLikesResult
**File:** `/src/repositories/ImageLikeRepository.ts`
**Description:** Result of image like query
**Key Properties:** index, count, likedByMe, likers

### GeniCacheHit
**File:** `/src/repositories/GeniCacheRepository.ts`
**Description:** Result from Geni cache repository
**Key Properties:** key, data, createdAt, updatedAt, stale

### AdminNotification
**File:** `/src/repositories/NotificationRepository.ts`
**Description:** Admin notification record
**Key Properties:** id, eventType, payload, createdAt

### ContactMessage
**File:** `/src/repositories/ContactRepository.ts`
**Description:** Contact form message in repository
**Key Properties:** id, name, email, message, createdAt

### PlatformDescription
**File:** `/src/repositories/PlatformRepository.ts`
**Description:** Platform description with translations
**Key Properties:** title, content, translations

---

## Service Interfaces

### FieldMeta
**File:** `/src/services/LocalizationService.client.ts`
**Description:** Metadata about a localized field
**Key Properties:** source, updatedAt

### LocalizableDocument
**File:** `/src/services/LocalizationService.client.ts`
**Description:** Base interface for documents with localizable content
**Key Properties:** locales

### TranslationResult
**File:** `/src/services/TranslationService.ts`
**Description:** Result from GPT translation
**Key Properties:** title, content

### BlogSchemaOptions
**File:** `/src/utils/blogSchema.ts`
**Description:** Options for generating blog schema markup
**Key Properties:** baseUrl, siteName, lang

### AuthorInfo
**File:** `/src/utils/blogSchema.ts`
**Description:** Blog post author information
**Key Properties:** name, handle, avatar, email

### LocalePreference
**File:** `/src/utils/locale.ts`
**Description:** Parsed Accept-Language header preference
**Key Properties:** tag, base, quality

### LocaleResolutionResult
**File:** `/src/utils/resolveLocale.ts`
**Description:** Result of locale resolution
**Key Properties:** baseLocale, resolvedLocale

### HealthCheckResult
**File:** `/src/types/health.ts`
**Description:** Health check API response
**Key Properties:** healthy, status

---

## Store Interfaces

### UserState
**File:** `/src/store/UserStore.ts`
**Description:** Zustand store for authenticated user
**Key Properties:** user, loading, setUser, setLoading, checkAuth, logout

### SiteStore
**File:** `/src/store/SiteStore.ts`
**Description:** Zustand store for site info and caching
**Key Properties:** siteInfo, siteCache, setSiteInfo, hydrateFromWindow, getSiteForLocale, cacheSiteForLocale

### MemberState
**File:** `/src/store/MemberStore.ts`
**Description:** Zustand store for member info
**Key Properties:** member, loading, error, fetchMember, setMember, clearMember, resolveAvatar, hydrateFromWindow

### MemberAvatar
**File:** `/src/store/MemberStore.ts`
**Description:** Computed avatar representation
**Signature:** { type: 'uploaded'; url: string } | { type: 'gravatar'; url: string } | { type: 'initials'; initials: string }

### ResolveAvatarOptions
**File:** `/src/store/MemberStore.ts`
**Description:** Options for resolving member avatar
**Key Properties:** fallbackEmail, fallbackName, size, includeUploaded

### LoginModalStore
**File:** `/src/store/LoginModalStore.ts`
**Description:** Zustand store for login modal state
**Key Properties:** isOpen, open, close

### NotMemberModalStore
**File:** `/src/store/NotMemberModalStore.ts`
**Description:** Zustand store for not-member modal state
**Key Properties:** isOpen, open, close

### PendingMemberModalStore
**File:** `/src/store/PendingMemberModalStore.ts`
**Description:** Zustand store for pending member modal state
**Key Properties:** isOpen, open, close

### EditUserModalStore
**File:** `/src/store/EditUserModalStore.ts`
**Description:** Zustand store for edit user modal state
**Key Properties:** isOpen, open, close

### PresentationModeState
**File:** `/src/store/PresentationModeStore.ts`
**Description:** Zustand store for presentation mode
**Key Properties:** active, enable, disable

---

## Like & Interaction Interfaces

### LikerInfo
**File:** `/src/types/likes.ts`
**Description:** Information about a user who liked content
**Key Properties:** uid, memberId, displayName, email, avatarUrl, likedAt

### ImageLikeMeta
**File:** `/src/types/likes.ts`
**Description:** Like metadata for a gallery image
**Key Properties:** index, count, likedByMe, likers

---

## Other Key Interfaces

### RefreshStore
**File:** `/src/auth/refresh-store/index.ts`
**Description:** Interface for refresh token storage (put/get/del)
**Key Properties:** put(), get(), del()

### MembershipStatus
**File:** `/src/store/MemberStore.ts`
**Description:** Enumeration of membership statuses
**Values:** Member, Pending, NotApplied, Error

### MemberRole
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Member role type
**Values:** 'admin' | 'member' | 'pending' | 'rejected'

### InviteStatus
**File:** `/src/repositories/FamilyRepository.ts`
**Description:** Invitation status
**Values:** 'pending' | 'used' | 'expired' | 'revoked'

### FamilyMember
**File:** `/src/repositories/FamilyRepository.ts`
**Description:** Type alias for LocalizedMemberRecord
**Signature:** = LocalizedMemberRecord

### FamilySite
**File:** `/src/repositories/FamilyRepository.ts`
**Description:** Type alias for ISite
**Signature:** = ISite

---

## Error Classes

### BlogRegistrationError
**File:** `/src/repositories/MemberRepository.ts`
**Description:** Error for blog registration failures
**Properties:** code ('not_found' | 'handle_taken' | 'immutable' | 'invalid')

### InviteError
**File:** `/src/repositories/FamilyRepository.ts`
**Description:** Error for invitation failures
**Properties:** code (string)

### TranslationDisabledError
**File:** `/src/repositories/SiteRepository.ts`
**Description:** Error when translation service is disabled
**Properties:** locale (string)

### SiteNotFoundError
**File:** `/src/repositories/SiteRepository.ts`
**Description:** Error when site is not found
**Properties:** siteId (string)

