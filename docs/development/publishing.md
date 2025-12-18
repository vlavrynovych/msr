---
layout: default
title: Publishing New Versions
parent: Development
nav_order: 7
---

# Publishing New Versions
{: .no_toc }

Release process and version management for MSR.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

This document describes the process for releasing new versions of Migration Script Runner and publishing them to npm.

---

## Semantic Versioning

MSR follows [Semantic Versioning (SemVer)](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

- **MAJOR** (x.0.0) - Incompatible API changes
- **MINOR** (0.x.0) - New features, backward compatible
- **PATCH** (0.0.x) - Bug fixes, backward compatible

### Pre-1.0 Development

During v0.x development:
- Minor versions MAY include breaking changes
- Always provide migration guides for breaking changes
- Major version 1.0.0 will be first stable release

---

## Release Checklist

### 1. Pre-Release Verification

- [ ] All tests pass (`npm test`)
- [ ] 100% test coverage maintained
- [ ] No linting errors (`npm run lint`)
- [ ] Mutation testing passes (`npm run test:mutation`)
- [ ] All CI/CD checks pass
- [ ] Documentation is up-to-date
- [ ] CHANGELOG.md is updated
- [ ] Migration guide created (if breaking changes)

### 2. Version Bump

```bash
# Update version in package.json
npm version patch   # Bug fixes (0.3.0 → 0.3.1)
npm version minor   # New features (0.3.0 → 0.4.0)
npm version major   # Breaking changes (0.3.0 → 1.0.0)
```

This command:
- Updates `package.json` version
- Creates a git commit
- Creates a git tag

### 3. Update Documentation

**Update these files:**

1. **CHANGELOG.md**
   ```markdown
   ## [0.4.0] - 2025-01-28

   ### Added
   - New feature X
   - New feature Y

   ### Changed
   - Updated behavior of Z

   ### Fixed
   - Bug fix A
   - Bug fix B

   ### Breaking Changes
   - API change C
   ```

2. **README.md** (if needed)
   - Update version badges
   - Update examples if API changed

3. **Migration Guide** (if breaking changes)
   - Create `do../version-migration/v0.X-to-v0.Y.md`
   - BEFORE/AFTER code examples
   - Step-by-step migration instructions

### 4. Build and Test

```bash
# Clean build
rm -rf dist node_modules
npm install
npm run build

# Run full test suite
npm test

# Verify coverage
npm run test:coverage

# Run mutation tests
npm run test:mutation
```

### 5. Push Tag to Trigger Automated Publishing

```bash
# Push tag to GitHub (triggers automated workflow)
git push origin v0.4.0

# Or push commit and tag together
git push origin master --tags
```

**What happens automatically:**
1. GitHub Actions workflow triggers on tag push
2. Installs dependencies (`npm ci`)
3. Runs build and tests (via `prepublishOnly` hook)
4. Publishes to npm with provenance
5. Package appears on npm with cryptographic signature

**Monitor the workflow:**
- GitHub → Actions → "Publish to npm"
- Check logs if publish fails

### 6. Post-Publication

1. **Create GitHub Release**
   ```bash
   # Create release from tag
   gh release create v0.4.0 --generate-notes

   # Or manually via GitHub UI
   # Go to GitHub → Releases → "Draft a new release"
   # Select the version tag
   # Title: v0.4.0
   # Description: Copy from CHANGELOG.md
   ```

2. **Verify npm Package**
   - Visit https://www.npmjs.com/package/@migration-script-runner/core
   - Verify new version is published
   - Check for "Provenance" badge (cryptographic proof)

3. **Announce Release**
   - Update project README if needed
   - Post in discussions if major release
   - Tweet/social media if significant

---

## Version Numbering Guidelines

### Patch Release (0.3.0 → 0.3.1)

**When:**
- Bug fixes only
- No new features
- No breaking changes
- Documentation fixes

**Example:**
```
v0.3.1
- Fixed array mutation bug in RollbackService
- Fixed typo in documentation
```

### Minor Release (0.3.0 → 0.4.0)

**When:**
- New features
- Backward compatible
- May include bug fixes
- May include deprecations

**Example:**
```
v0.4.0
- Added MySQL handler support
- Added new configuration option: retryAttempts
- Fixed backup path resolution
```

### Major Release (0.x.0 → 1.0.0)

**When:**
- Breaking API changes
- Significant architectural changes
- Removed deprecated features

**Example:**
```
v1.0.0
- BREAKING: migrate() now returns Promise<Result>
- BREAKING: Removed deprecated cfg property from handler
- Added comprehensive migration guide
```

---

## Breaking Changes Policy

### What Constitutes a Breaking Change

- **API Changes**: Method signature changes, parameter removal
- **Behavior Changes**: Different default behavior
- **Removals**: Removing public APIs or features
- **Type Changes**: TypeScript interface changes

### How to Handle Breaking Changes

1. **Document in CHANGELOG**
   ```markdown
   ### Breaking Changes
   - **migrate() return type**: Changed from void to IMigrationResult
   - **Migration Required**: See migration guide for upgrade path
   ```

2. **Create Migration Guide**
   - File: `do../version-migration/v0.X-to-v0.Y.md`
   - Include BEFORE/AFTER examples
   - Step-by-step instructions
   - Explain rationale for change

3. **Update API Documentation**
   - Mark old behavior as deprecated (if transitioning)
   - Document new behavior
   - Add breaking change notice

4. **Consider Deprecation Period**
   - For major changes, deprecate first in minor version
   - Remove in next major version
   - Give users time to migrate

---

## Release Automation

### Automated Publishing Workflow

**Workflow:** `.github/workflows/npm-publish.yml`

**Triggers:**
- Push of version tags (e.g., `v0.8.0`, `v1.0.0`)
- Manual trigger via GitHub Actions UI

**Process:**
1. Checkout repository
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Run build and tests (via `prepublishOnly` hook)
5. Publish to npm with provenance signature
6. Authenticate using `NPM_TOKEN` secret (granular access token)

**Security Features:**
- ✅ Cryptographic provenance (build transparency)
- ✅ Granular npm token (package-specific permissions)
- ✅ 90-day token expiration (enforced security)
- ✅ No long-lived credentials in code

### Token Management

**NPM_TOKEN Secret:**
- Type: Granular Access Token
- Scope: `@migration-script-runner/core` (read/write)
- Expiration: 90 days
- Bypass 2FA: Enabled (for CI/CD automation)

**Renewal Process:**
1. Create new token on npmjs.com 80 days before expiration
2. Update GitHub secret: `gh secret set NPM_TOKEN`
3. Delete old token on npmjs.com

### Manual Publishing (Emergency)

If automated workflow fails, you can publish manually:

```bash
# Ensure you're on the tagged commit
git checkout v0.8.0

# Build and test
npm ci
npm run build
npm test

# Publish with provenance
npm publish --access public
# Will prompt for 2FA code
```

---

## Hotfix Process

For critical bugs in production:

### 1. Create Hotfix Branch

```bash
git checkout -b hotfix/critical-bug master
```

### 2. Fix the Bug

- Minimal changes only
- Focus on the specific issue
- Add regression test

### 3. Fast-Track Release

```bash
# Test
npm test

# Version bump (patch)
npm version patch

# Publish
npm publish

# Merge back to master
git checkout master
git merge hotfix/critical-bug
git push origin master --tags
```

---

## Version History

### Maintaining CHANGELOG.md

**Format:**
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Features in development

## [0.3.0] - 2025-01-28
### Added
- Checksum integrity checking
- Path traversal security validation

### Changed
- Config now separate parameter (breaking)

### Fixed
- Array mutation in RollbackService

## [0.2.0] - 2024-12-15
...
```

---

## npm Package Configuration

### package.json Essentials

```json
{
  "name": "@migration-script-runner/core",
  "version": "0.3.0",
  "description": "Migration Script Runner - Core Framework",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "/dist"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/migration-script-runner/msr-core.git"
  },
  "keywords": [
    "migration",
    "database",
    "typescript"
  ],
  "license": "MIT"
}
```

**Important Fields:**
- `files`: Only include `dist/` in npm package
- `main`: Entry point for require()
- `types`: TypeScript definitions
- `repository`: Link to GitHub

---

## Rollback a Release

If a release has critical issues:

### 1. Deprecate on npm

```bash
npm deprecate @migration-script-runner/core@0.4.0 "Critical bug, use 0.4.1"
```

### 2. Publish Fixed Version

```bash
npm version patch
npm publish
```

### 3. Update Documentation

- Mark version as deprecated in CHANGELOG
- Link to fixed version
- Explain the issue

---

## Quick Reference

| Task | Command |
|------|---------|
| Bump patch version | `npm version patch` |
| Bump minor version | `npm version minor` |
| Bump major version | `npm version major` |
| Push tag (triggers publish) | `git push origin v0.8.0` |
| Create GitHub release | `gh release create v0.8.0 --generate-notes` |
| Manual publish (emergency) | `npm publish --access public` |
| Deprecate version | `npm deprecate @migration-script-runner/core@0.8.0 "message"` |
| View published versions | `npm view @migration-script-runner/core versions` |
| Check workflow status | GitHub → Actions → "Publish to npm" |
