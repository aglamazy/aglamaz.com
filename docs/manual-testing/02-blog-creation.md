# Test 02: Blog Creation and First Post

**Test Date**: _____________
**Tester**: _____________
**Version**: _____________

## Overview
Test blog registration, handle selection, first post creation with rich text formatting, and public blog viewing.

## Prerequisites
- [ ] Member account logged in (from Test 01 or existing member)
- [ ] Member does NOT have blog enabled yet
- [ ] Member has completed onboarding

---

## Part 1: Access Blog Section

### 1.1 Navigate to Blog
- [ ] From `/app` dashboard, locate "Blog" in navigation
- [ ] Click "Blog" menu item
- [ ] Page loads successfully

### 1.2 View Blog CTA
- [ ] "Start your blog" message appears
- [ ] Description explains blog feature
- [ ] "Start" or "Create Blog" button visible

**Notes**:
_____________________________________________

---

## Part 2: Blog Setup

### 2.1 Open Blog Setup
- [ ] Click "Start" or "Create Blog" button
- [ ] Modal or page appears
- [ ] Title: "Set up your blog" or similar
- [ ] Instructions explain:
  - [ ] Blog handle is your unique URL
  - [ ] Handle cannot be changed later
  - [ ] Content respects IP rights

### 2.2 Choose Blog Handle
- [ ] Suggested handle appears (from email)
- [ ] Suggested format looks good (e.g., "yaakov-aglamaz")
- [ ] Input field for handle visible
- [ ] Character requirements shown (3-50 chars, lowercase, numbers, hyphens)

### 2.3 Test Handle Validation
- [ ] Try too short handle (< 3 chars)
  - [ ] Error message appears
- [ ] Try invalid characters (uppercase, spaces, special chars)
  - [ ] Error message appears
- [ ] Enter valid handle: _____________
  - [ ] Checking indicator appears (spinner)
  - [ ] Green checkmark shows if available
  - [ ] OR red X if taken (try another)

### 2.4 Preview URL
- [ ] Preview URL shown: `your-site.com/blog/[your-handle]`
- [ ] URL updates as you type
- [ ] Format looks correct

**Chosen handle**: _____________

**Notes**:
_____________________________________________

---

## Part 3: Accept Terms

### 3.1 Review Terms
- [ ] Blog terms section visible
- [ ] Checkboxes for:
  - [ ] "Respect intellectual property rights"
  - [ ] "No harmful/offensive content"
  - [ ] "Content may be moderated"
- [ ] Site terms section visible
- [ ] Link to full terms available

### 3.2 Accept Terms
- [ ] Check blog terms checkbox
- [ ] Check site terms checkbox
- [ ] "Create Blog" button becomes enabled (was disabled)
- [ ] Button has clear styling

**Notes**:
_____________________________________________

---

## Part 4: Create Blog

### 4.1 Submit Blog Creation
- [ ] Click "Create Blog" button
- [ ] Button shows loading state
- [ ] No error messages appear

### 4.2 Redirect to Blog
- [ ] Success message appears briefly
- [ ] Redirects automatically
- [ ] Lands on blog posts list page
- [ ] URL is `/app/blog` or similar
- [ ] "New Post" button visible

**Notes**:
_____________________________________________

---

## Part 5: Create First Post

### 5.1 Open Post Editor
- [ ] Click "New Post" button (FAB or regular button)
- [ ] Editor page loads
- [ ] URL is `/app/blog/new` or similar
- [ ] Editor interface appears

### 5.2 Enter Post Details
- [ ] Title field visible and focused
- [ ] Enter title: _____________
- [ ] Rich text editor (TinyMCE) loaded
- [ ] Editor toolbar visible

### 5.3 Toolbar Features Check
- [ ] Bold button present
- [ ] Italic button present
- [ ] Underline button present
- [ ] Lists (bullet/numbered) present
- [ ] Link button present
- [ ] Image button present
- [ ] Emoji picker present

**Notes**:
_____________________________________________

---

## Part 6: Format Content

### 6.1 Basic Formatting
- [ ] Type some text: _____________
- [ ] Select text and click Bold
  - [ ] Text becomes bold
- [ ] Select text and click Italic
  - [ ] Text becomes italic
- [ ] Create bullet list
  - [ ] List formats correctly
- [ ] Create numbered list
  - [ ] Numbers appear automatically

### 6.2 Add Celebration Emojis
- [ ] Click emoji button in toolbar
- [ ] Emoji picker opens
- [ ] Birthday/celebration emojis visible:
  - [ ] 🎉 Party popper
  - [ ] 🎊 Confetti
  - [ ] 🍷 Wine glass
  - [ ] 🎂 Birthday cake
  - [ ] ❤️ Red heart
  - [ ] 💕 Two hearts
- [ ] Click emoji to insert
  - [ ] Emoji appears in editor at cursor

### 6.3 Insert Inline Photo
- [ ] Click image button in toolbar
- [ ] Image upload dialog appears
- [ ] Select/upload image file
- [ ] Image uploads (loading indicator)
- [ ] Image appears in editor
- [ ] Image can be resized by dragging

**Note**: Currently uses base64 encoding (expensive, see TODO.md)

**Notes**:
_____________________________________________

---

## Part 7: Save Post

### 7.1 Visibility Settings
- [ ] "Public" toggle visible
- [ ] Toggle OFF = private (family only)
- [ ] Toggle ON = public (visible on public blog)
- [ ] Set as desired: [ ] Public / [ ] Private

### 7.2 Submit Post
- [ ] Click "Save" or "Publish" button
- [ ] Button shows loading state
- [ ] No error messages appear

### 7.3 Redirect After Save
- [ ] Success message appears
- [ ] Redirects to:
  - [ ] Post list page, OR
  - [ ] Post view page
- [ ] Post appears in list (if redirected to list)

**Post URL**: _____________

**Notes**:
_____________________________________________

---

## Part 8: View Post

### 8.1 View from List
- [ ] Navigate to post from list (if not already viewing)
- [ ] Click post title or "View" button
- [ ] Post page loads
- [ ] URL is `/app/blog/[post-id]` or similar

### 8.2 Post Display Check
- [ ] Title displays correctly
- [ ] Author name visible
- [ ] Timestamp visible
- [ ] Content displays with formatting:
  - [ ] Bold text appears bold
  - [ ] Italic text appears italic
  - [ ] Lists formatted correctly
  - [ ] Emojis render correctly
  - [ ] Images display properly
- [ ] Edit button visible (for author)
- [ ] Delete button visible (for author)

### 8.3 Public Blog View (if post is public)
- [ ] Navigate to `/blog/[your-handle]`
- [ ] Public blog page loads
- [ ] Site header with blog name
- [ ] Post appears in feed
- [ ] Post preview shows correctly
- [ ] Click post to view full content
- [ ] Full post displays

**Notes**:
_____________________________________________

---

## Part 9: Edit Post

### 9.1 Open Editor
- [ ] From post view, click "Edit" button
- [ ] Returns to editor page
- [ ] Title field pre-filled with current title
- [ ] Content loaded in editor
- [ ] All formatting preserved

### 9.2 Make Changes
- [ ] Modify title: _____________
- [ ] Add or change some content
- [ ] Add another emoji or image (optional)

### 9.3 Save Changes
- [ ] Click "Save" button
- [ ] Loading state appears
- [ ] Success message
- [ ] Redirects to post view

### 9.4 Verify Changes
- [ ] New title displayed
- [ ] Content changes visible
- [ ] All formatting still intact

**Notes**:
_____________________________________________

---

## Part 10: Delete Post (Optional)

### 10.1 Attempt Delete
- [ ] From post view, click "Delete" button
- [ ] Confirmation dialog appears
- [ ] Dialog asks "Delete post?"
- [ ] Warning that action cannot be undone

### 10.2 Confirm or Cancel
- [ ] Click "Delete" to confirm, OR
- [ ] Click "Cancel" to abort
- [ ] If deleted:
  - [ ] Post removed from list
  - [ ] Redirect to blog list
  - [ ] Post no longer accessible

**Action taken**: [ ] Deleted / [ ] Kept

**Notes**:
_____________________________________________

---

## Part 11: Version and Health Check

### 11.1 Footer Version
- [ ] Scroll to footer on any page
- [ ] Version visible: `© 2025 SiteName. v0.5.X. All rights reserved.`
- [ ] Version format correct

### 11.2 Health API Check
- [ ] Open `/api/health` in new tab
- [ ] JSON response shows:
  ```json
  {
    "version": "0.5.X",
    "firebase": { "healthy": true },
    "gmail": { "healthy": true },
    "translation": { "healthy": true },
    "overall": { "healthy": true }
  }
  ```
- [ ] All services healthy
- [ ] Version matches footer

**Version tested**: _____________

**Notes**:
_____________________________________________

---

## Known Issues

### Issue 1: Base64 Image Storage
**Symptom**: Large images may slow down editor/post load
**Reason**: Images stored as base64 in Firestore (expensive)
**Future**: Will migrate to Firebase Storage (see TODO.md)
**Observed**: [ ] Yes / [ ] No

### Issue 2: Blog Handle Uniqueness
**Symptom**: Handle may be taken by another user
**Expected**: Real-time validation should catch this
**Observed**: [ ] Yes / [ ] No

---

## Test Summary

**Total Steps**: 80+
**Steps Passed**: _____
**Steps Failed**: _____
**Issues Found**: _____

**Overall Result**: [ ] PASS / [ ] FAIL / [ ] PARTIAL

**Additional Notes**:
_____________________________________________
_____________________________________________
_____________________________________________
