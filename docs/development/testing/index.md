---
layout: default
title: Testing
parent: Development
nav_order: 4
has_children: true
---

# Testing
{: .no_toc }

Comprehensive testing guide for Migration Script Runner.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR maintains 100% test coverage across all metrics. This section covers testing standards, tools, and best practices for both the framework itself and your migrations.

---

## Testing Standards

### Coverage Requirements

- **100% coverage required** for all metrics:
  - Statements: 100%
  - Branches: 100%
  - Functions: 100%
  - Lines: 100%

### Test Types

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test component interactions
3. **Mutation Tests** - Verify test quality with Stryker

---

## Quick Reference

| Task | Command |
|------|---------|
| Run all tests | `npm test` |
| Run with coverage | `npm run test:coverage` |
| Run unit tests | `npm run test:unit` |
| Run integration tests | `npm run test:integration` |
| Run mutation tests | `npm run test:mutation` |
| Run specific test | `npm run test:one -- path/to/test.ts` |

---

## Testing Guides

### [Mutation Testing](mutation-testing)
In-depth guide to mutation testing with Stryker:
- What is mutation testing
- Running mutation tests
- Understanding mutation scores
- Interpreting results
