---
layout: default
title: Models & Enums
parent: API Reference
nav_order: 3
---

# Models & Enums
{: .no_toc }

Model classes and enumeration types.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Model Classes

### MigrationScript

Represents a migration script file.

```typescript
class MigrationScript {
  timestamp: number;
  name: string;
  filepath: string;
  script?: IMigrationScript;
  startedAt?: number;
  username?: string;
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `timestamp` | `number` | Migration version number |
| `name` | `string` | Migration filename |
| `filepath` | `string` | Absolute path to migration file |
| `script` | `IMigrationScript?` | Loaded migration instance |
| `startedAt` | `number?` | Execution start timestamp |
| `username` | `string?` | User executing migration |

#### Methods

##### init()

Load and instantiate the migration script.

```typescript
await migrationScript.init(): Promise<void>
```

Dynamically imports the migration file and creates an instance of the exported class.

---

## Utility Classes

### Utils

Internal utility functions (not typically used directly).

```typescript
import { Utils } from '@migration-script-runner/core';
```

#### Methods

##### promiseAll()

Resolve all promises in an object, preserving keys.

```typescript
static async promiseAll<T>(map: { [key: string]: Promise<T> }): Promise<{ [key: string]: T }>
```

Similar to `Promise.all()` but works with objects instead of arrays.

---

##### parseRunnable()

Parse and instantiate a migration script from a file path.

```typescript
static async parseRunnable(filepath: string): Promise<IMigrationScript>
```

**Parameters:**
- `filepath`: Absolute path to migration file

**Returns:** Instance of migration script

**Throws:** Error if file cannot be parsed or doesn't contain valid migration

---

