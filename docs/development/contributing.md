---
layout: default
title: Contributing
parent: Development
nav_order: 6
---

# Contributing to MSR
{: .no_toc }

Guide for contributors and maintainers.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Development Setup

### Prerequisites

- Node.js 16 or higher
- npm 7 or higher
- Git

### Clone and Install

```bash
git clone https://github.com/migration-script-runner/msr-core.git
cd msr-core
npm install
```

---

## Development Workflow

### Running Tests

```bash
# Run all tests (linter + unit + integration)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run mutation tests (slow)
npm run test:mutation
```

### Building

```bash
# Build the project
npm run build

# The compiled output will be in ./dist
```

### Code Quality

```bash
# Run linter
npm run lint

# Generate all reports (lint + coverage)
npm run test:report
```

---

## Publishing New Versions

### Automated Publishing (Recommended)

GitHub Actions automatically publishes to npm when the version in `package.json` changes:

1. **Update the version** in `package.json`:
   ```bash
   # For patch releases (bug fixes)
   npm version patch

   # For minor releases (new features, backward compatible)
   npm version minor

   # For major releases (breaking changes)
   npm version major
   ```

2. **Commit and push**:
   ```bash
   git push origin master
   git push origin --tags
   ```

3. **GitHub Actions will automatically**:
   - Run all tests
   - Build the package
   - Publish to npm
   - Create git tag

### Manual Publishing

If you need to publish manually:

1. **Ensure you're logged in to npm**:
   ```bash
   npm whoami
   # If not logged in:
   npm login
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Publish to npm**:
   ```bash
   npm publish --access public
   ```

4. **Create and push git tag**:
   ```bash
   git tag v0.2.x
   git push origin v0.2.x
   ```

5. **Create GitHub release**:
   ```bash
   gh release create v0.2.x \
     --title "v0.2.x - Release Title" \
     --notes "Release notes here"
   ```

---

## Release Checklist

Before releasing a new version:

- [ ] All tests pass (`npm test`)
- [ ] Code coverage is 100% (`npm run test:coverage`)
- [ ] Documentation is updated
- [ ] CHANGELOG is updated (if exists)
- [ ] Version is bumped in `package.json`
- [ ] Breaking changes are documented in migration guide (for major/minor with breaking changes)

After releasing:

- [ ] Verify package appears on npm: https://www.npmjs.com/package/@migration-script-runner/core
- [ ] Verify GitHub release is created
- [ ] Update documentation site if needed
- [ ] Close related issues and milestone

---

## Code Style

- Follow existing code conventions
- Use TypeScript for all code
- Add JSDoc comments for all public APIs
- Keep test coverage at 100%
- Use meaningful variable and function names

---

## Pull Request Process

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Write tests** for new functionality
5. **Run tests** to ensure everything passes
6. **Commit your changes** with descriptive messages
7. **Push to your fork**
8. **Open a Pull Request** with:
   - Clear description of changes
   - Link to related issues
   - Test results

---

## Commit Message Guidelines

Use clear, descriptive commit messages:

```bash
# Good examples
Fix #42: Resolve backup deletion issue
Add displayLimit configuration option
Update documentation for new list() method

# Bad examples
fix bug
update
changes
```

**Format:**
- Start with action verb (Add, Fix, Update, Remove, etc.)
- Reference issue number if applicable (`Fix #42:`)
- Keep first line under 72 characters
- Add detailed explanation in body if needed

---

## Documentation

### Updating Documentation

Documentation is in the `docs/` folder using Jekyll and Just the Docs theme.

**Local preview:**
```bash
# Install Jekyll (one time)
gem install bundler jekyll

# Run locally
cd docs
bundle exec jekyll serve

# View at http://localhost:4000/msr-core/
```

**Documentation structure:**
- `docs/index.md` - Homepage
- `docs/getting-started.md` - Getting started guide
- `docs/configuration.md` - Configuration reference
- `docs/api/` - API documentation
- `docs/guides/` - User guides
- `docs/migrations/` - Migration guides

---

## Need Help?

- **Issues:** https://github.com/migration-script-runner/msr-core/issues
- **Discussions:** https://github.com/migration-script-runner/msr-core/discussions
- **Email:** volodyalavrynovych@gmail.com

Thank you for contributing! 🎉
