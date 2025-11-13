# Manual Testing Guide

This directory contains step-by-step manual testing procedures for the Aglamaz family site platform.

## Test Suites

1. **[Onboarding Flow](./01-onboarding.md)** - Complete user onboarding from invite to first login
2. **[Blog Creation](./02-blog-creation.md)** - Blog setup and first post creation

## How to Use

Each test file contains:
- Prerequisites - what you need before starting
- Step-by-step instructions with checkboxes
- Expected results for each step
- Known issues to watch for

### Markdown Checkbox Format

Each test uses GitHub-flavored markdown checkboxes:
- `- [ ]` = Unchecked (not tested yet)
- `- [x]` = Checked (test passed)

You can edit the files directly and mark checkboxes as you complete each step.

### Viewing Tests

**Option 1: GitHub/GitLab**
- View the markdown files in your repository
- Checkboxes will render as interactive elements

**Option 2: VSCode**
- Install "Markdown Checkboxes" extension
- Open test files and toggle checkboxes with Alt+C (Windows/Linux) or Cmd+C (Mac)

**Option 3: Markdown Preview**
- Use VSCode's built-in markdown preview (Ctrl+Shift+V)
- Or any markdown viewer that supports task lists

## Test Status Tracking

After running tests, commit the updated markdown files with checked boxes:
```bash
git add docs/manual-testing/
git commit -m "Update manual test results for [test-name]"
```

This creates a testing history in your git log.

## Adding New Tests

To add a new test suite:
1. Create new file: `docs/manual-testing/XX-test-name.md`
2. Use existing test files as templates
3. Update this README with the new test
4. Follow the checkbox format for consistency
