---
layout: default
title: Development Setup
parent: Development
nav_order: 1
---

# Development Setup
{: .no_toc }

Set up your development environment for contributing to MSR.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Prerequisites

### Required Software

- **Node.js**: 14.x or higher
- **npm**: 6.x or higher (or yarn 1.x+)
- **Git**: 2.x or higher
- **TypeScript**: 4.x or higher (installed via npm)

### Recommended Tools

- **IDE**: VSCode, WebStorm, or any TypeScript-aware editor
- **Git UI**: GitKraken, SourceTree, or built-in IDE git

---

## Initial Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/msr-core.git
cd msr-core
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- TypeScript compiler
- Mocha test framework
- Chai assertion library
- ESLint for linting
- NYC for coverage
- Stryker for mutation testing

### 3. Verify Installation

```bash
# Build the project
npm run build

# Run tests
npm test

# Check coverage
npm run test:coverage
```

**Expected Output:**
```
✓ 573 tests passing
Coverage: 100% (statements, branches, functions, lines)
```

---

## Project Structure

```
msr-core/
├── src/                   # Source code
│   ├── error/            # Error classes
│   ├── hooks/            # Lifecycle hooks
│   ├── interface/        # TypeScript interfaces
│   ├── logger/           # Logger implementations
│   ├── model/            # Model classes
│   └── service/          # Service layer
├── test/                  # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   ├── benchmarks/       # Performance tests
│   └── helpers/          # Test utilities
├── docs/                  # Documentation
├── dist/                  # Compiled JavaScript (gitignored)
└── coverage/              # Coverage reports (gitignored)
```

---

## npm Scripts

### Building

```bash
# Clean build
npm run build

# Watch mode (auto-rebuild on changes)
npm run build:watch  # If available
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run specific test file
npm run test:one -- test/unit/service/RollbackService.test.ts

# Watch mode (auto-run on changes)
npm run test:watch
```

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix  # If available
```

### Mutation Testing

```bash
# Run mutation tests (takes longer)
npm run test:mutation

# Incremental mode (only changed files)
npm run test:mutation:incremental
```

---

## IDE Configuration

### VSCode

**Recommended Extensions:**
- ESLint
- TypeScript and JavaScript Language Features
- GitLens
- Test Explorer UI

**Settings (`.vscode/settings.json`):**
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": [
    "javascript",
    "typescript"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true,
  "files.exclude": {
    "**/dist": true,
    "**/coverage": true,
    "**/.nyc_output": true
  }
}
```

### WebStorm / IntelliJ

1. **TypeScript**: Settings → Languages & Frameworks → TypeScript
   - Enable TypeScript Language Service
   - Use project TypeScript version

2. **ESLint**: Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
   - Enable automatic ESLint configuration

3. **Test Runner**: Run → Edit Configurations
   - Add Mocha configuration
   - Test directory: `test`
   - User interface: `bdd`

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/issue-123
```

### 2. Make Changes

- Edit source files in `src/`
- Add/update tests in `test/`
- Update documentation in `docs/`

### 3. Verify Changes

```bash
# Build
npm run build

# Test
npm test

# Coverage (must be 100%)
npm run test:coverage

# Lint
npm run lint
```

### 4. Commit Changes

```bash
git add .
git commit -m "#123: Add new feature"
```

**Commit Message Format:**
```
#<issue-number>: <short description>

<detailed description>

<breaking changes if any>
```

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Then create a Pull Request on GitHub.

---

## Troubleshooting

### Build Errors

**Issue:** TypeScript compilation fails

**Solution:**
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Test Failures

**Issue:** Tests fail after fresh clone

**Solution:**
```bash
# Ensure dependencies are installed
npm install

# Try running specific test
npm run test:one -- test/unit/service/YourService.test.ts
```

### Coverage Below 100%

**Issue:** Coverage report shows < 100%

**Solution:**
- Add tests for uncovered lines
- Check branch coverage
- See [Testing Guide](testing/) for coverage requirements

### Permission Errors (macOS)

**Issue:** `EACCES` errors during npm install

**Solution:**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
```

---

## Next Steps

- Read [Development Workflow](workflow) for the contribution process
- Review [Architecture](architecture) to understand the codebase
- Check [Testing Guide](testing/) for testing standards
- See [Contributing Guide](contributing) for PR guidelines

---

## Common Commands Quick Reference

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript |
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run lint` | Run ESLint |
| `npm run test:mutation` | Run mutation tests |
