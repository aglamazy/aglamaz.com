# Test 01: User Onboarding Flow

**Test Date**: _____________
**Tester**: _____________
**Version**: _____________

## Overview
Test the complete user onboarding flow including hard delete cleanup, invite generation, email verification, credential setup, and first login.

## Prerequisites
- [ ] Admin account available and logged in
- [ ] Test user Google account available (not currently registered in system)
- [ ] Access to test user's email inbox

---

## Part 1: Clean Up Previous Test Data

### 1.1 Navigate to Member Management
- [ ] Go to `/admin/site-members`
- [ ] Page loads successfully
- [ ] Member list displays

### 1.2 Hard Delete Test User (if exists)
- [ ] Locate test user in member list
- [ ] Click "Hard Delete" button (darker red button)
- [ ] Confirmation dialog appears with user details
- [ ] Dialog title: "Permanently Delete User?"
- [ ] Click "Hard Delete" in dialog
- [ ] Loading state shows while deleting
- [ ] User disappears from member list
- [ ] No error messages appear

**Expected**: User completely removed (Firebase Auth + member document)

**Notes**:
_____________________________________________

---

## Part 2: Generate Invite Link

### 2.1 Create Invite
- [ ] Scroll to "Invite Members" section at top of page
- [ ] Click "Generate Invite Link" button
- [ ] Button shows loading state
- [ ] Invite link appears in a box
- [ ] Expiration time displayed (24 hours from now)
- [ ] Time format is localized (e.g., "Link expires at 10:30 PM")

### 2.2 Copy Link
- [ ] Click "Copy Link" button
- [ ] Success message appears: "Link copied!"
- [ ] Message disappears after 3 seconds

**Invite URL**: _____________________________________________

**Notes**:
_____________________________________________

---

## Part 3: Accept Invite (New Browser Session)

### 3.1 Open Invite Link
- [ ] Open invite URL in incognito/private window
- [ ] Invite page loads
- [ ] Site name displays correctly
- [ ] Welcome message appears
- [ ] Invited by name shows (if available)
- [ ] Expiration time shows

### 3.2 Fill Signup Form
- [ ] Click "Join" or signup button
- [ ] Modal/form opens
- [ ] Enter first name: _____________
- [ ] Enter email: _____________
- [ ] Form validates email format
- [ ] Click "Submit Request" button
- [ ] Button shows loading state

### 3.3 Check Email Sent
- [ ] "Check your email" message appears
- [ ] Email address displayed correctly
- [ ] Instructions mention clicking link

**Notes**:
_____________________________________________

---

## Part 4: Email Verification

### 4.1 Check Email
- [ ] Check test user's email inbox
- [ ] Verification email received
- [ ] Email subject appropriate
- [ ] Sender looks correct
- [ ] Email content in correct language

### 4.2 Click Verification Link
- [ ] Click verification link in email
- [ ] Link opens in browser
- [ ] URL is `/auth/invite/[token]/verify?code=...`
- [ ] Loading indicator appears
- [ ] Automatic verification starts

### 4.3 Verification Success
- [ ] Success message appears
- [ ] Redirects automatically (within 2-3 seconds)
- [ ] Lands on credential setup page `/auth/welcome/credentials`

**Notes**:
_____________________________________________

---

## Part 5: Credential Setup

### 5.1 View Credential Options
- [ ] Page title: "Choose Login Method" or similar
- [ ] Two options visible:
  - [ ] Password setup section
  - [ ] Google login section
- [ ] Instructions are clear

### 5.2 Option A: Set Up Password
- [ ] Enter password (min 8 characters): _____________
- [ ] Password field masks input
- [ ] Enter same password in confirm field
- [ ] Confirm field validates match
- [ ] Click "Save Password" button
- [ ] Button shows loading state
- [ ] Success message appears
- [ ] Redirects to `/app` within 1 second
- [ ] **Skip to Part 6**

### 5.3 Option B: Link Google Account
- [ ] Click "Continue with Google" button
- [ ] Google sign-in popup opens
- [ ] Select test Google account
- [ ] Account picker shows correct account
- [ ] Authorize permissions if prompted
- [ ] Popup closes automatically
- [ ] Success indication
- [ ] Redirects to `/app`

**Notes**:
_____________________________________________

---

## Part 6: Verify Access

### 6.1 Dashboard Access
- [ ] Lands on `/app` dashboard
- [ ] Page loads without errors
- [ ] Family calendar visible
- [ ] Navigation menu present
- [ ] User menu shows in header

### 6.2 User Profile Check
- [ ] Click user menu/avatar
- [ ] Dropdown opens
- [ ] User name displayed correctly: _____________
- [ ] Email displayed correctly: _____________
- [ ] "Settings" option available

### 6.3 Navigate to Settings
- [ ] Click "Settings" in menu
- [ ] Settings page loads
- [ ] Profile information section visible
- [ ] Name field shows correct value
- [ ] Email field shows correct value

**Notes**:
_____________________________________________

---

## Part 7: Locale Preservation (If Testing Non-English)

### 7.1 Check Language Throughout Flow
- [ ] Invite page in correct locale (e.g., Hebrew)
- [ ] Signup form in same locale
- [ ] Email content in same locale
- [ ] Verification page in same locale
- [ ] Credential setup in same locale
- [ ] Dashboard in same locale

### 7.2 Verify URL Locales
- [ ] Invite URL includes locale if needed
- [ ] Email link preserves locale
- [ ] Final redirect goes to localized app

**Notes**:
_____________________________________________

---

## Part 8: Version Check

### 8.1 Footer Version
- [ ] Scroll to footer on any page
- [ ] Version number visible
- [ ] Format: `© 2025 SiteName. v0.5.X. All rights reserved.`
- [ ] Version matches package.json

### 8.2 Health API
- [ ] Open `/api/health` in new tab
- [ ] JSON response received
- [ ] `version` field present
- [ ] Version matches footer

**Version tested**: _____________

**Notes**:
_____________________________________________

---

## Known Issues

### Issue 1: Cached Session After Hard Delete
**Symptom**: Deleted user can still see pages for ~1 hour
**Reason**: Firebase token remains valid until expiration
**Workaround**: Clear browser cache or wait for token expiry
**Observed**: [ ] Yes / [ ] No

### Issue 2: Wrong Locale Detection
**Symptom**: Auth pages show wrong language
**Reason**: Accept-Language header from browser
**Workaround**: Add `?locale=he` to URL manually
**Observed**: [ ] Yes / [ ] No

---

## Test Summary

**Total Steps**: 60+
**Steps Passed**: _____
**Steps Failed**: _____
**Issues Found**: _____

**Overall Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Additional Notes**:
_____________________________________________
_____________________________________________
_____________________________________________
