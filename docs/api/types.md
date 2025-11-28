---
layout: default
title: TypeScript Types
parent: API Reference
nav_order: 5
---

# TypeScript Types
{: .no_toc }

Type definitions and aliases for TypeScript users.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## TypeScript Types

All classes and interfaces are fully typed. Import types as needed:

```typescript
import {
  IMigrationScript,
  IMigrationInfo,
  IMigrationResult,
  IDatabaseMigrationHandler,
  Config,
  BackupConfig,
  MigrationScriptExecutor
} from '@migration-script-runner/core';
```

---

