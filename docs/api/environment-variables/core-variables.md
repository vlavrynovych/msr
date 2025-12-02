---
layout: default
title: Core Configuration
parent: Environment Variables
grand_parent: API Reference
nav_order: 1
---

# Core Configuration Variables
{: .no_toc }

Environment variables for basic MSR configuration including migration file discovery, tracking, and execution.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Core environment variables control the fundamental behavior of Migration Script Runner:
- Where to find migration files
- How to track schema versions
- Migration execution modes
- File discovery patterns

---

## Variables

### MSR_FOLDER

**Migration files directory**

- **Type**: `string`
- **Default**: `./migrations`
- **Example**: `./database/migrations`, `/app/migrations`

Specifies the directory containing migration files. Can be relative or absolute path.

```bash
export MSR_FOLDER=./database/migrations
```

**Programmatic Equivalent:**
```typescript
config.folder = './database/migrations';
```

**See Also:**
- [Migration Settings](../../configuration/migration-settings#folder)
- [Writing Migrations](../../guides/writing-migrations)

---

### MSR_TABLE_NAME

**Schema version tracking table name**

- **Type**: `string`
- **Default**: `schema_version`
- **Example**: `migration_history`, `db_migrations`

Name of the database table used to track executed migrations and schema versions.

```bash
export MSR_TABLE_NAME=migration_history
```

**Programmatic Equivalent:**
```typescript
config.tableName = 'migration_history';
```

**See Also:**
- [Migration Settings](../../configuration/migration-settings#tablename)
- [Schema Versioning](../../guides/version-control)

---

### MSR_BEFORE_MIGRATE_NAME

**Setup function name**

- **Type**: `string`
- **Default**: `beforeMigrate`
- **Example**: `setup`, `init`, `prepare`

Name of the optional setup function that runs once before migrations execute.

```bash
export MSR_BEFORE_MIGRATE_NAME=setup
```

**Programmatic Equivalent:**
```typescript
config.beforeMigrateName = 'setup';
```

**Usage in Migration:**
```typescript
export async function setup(db: IDB): Promise<void> {
  // One-time setup logic
  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
}

export async function up(db: IDB): Promise<void> {
  // Migration logic
}
```

**See Also:**
- [Migration Settings](../../configuration/migration-settings#beforemigratename)
- [Writing Migrations](../../guides/writing-migrations#before-migrate-hook)

---

### MSR_DRY_RUN

**Test migrations without committing**

- **Type**: `boolean`
- **Default**: `false`
- **Example**: `true`, `false`

When enabled, migrations run in transactions but are rolled back instead of committed. Perfect for testing migrations safely.

```bash
export MSR_DRY_RUN=true
```

**Programmatic Equivalent:**
```typescript
config.dryRun = true;
```

**Use Cases:**
- Test migrations before production deployment
- Verify migration scripts in CI/CD
- Debug migration issues without affecting database

**See Also:**
- [Dry Run Mode](../../guides/dry-run)
- [Testing Migrations](../../guides/testing-migrations)

---

### MSR_DISPLAY_LIMIT

**Limit displayed migrations**

- **Type**: `number`
- **Default**: `0` (show all)
- **Example**: `10`, `20`, `50`

Maximum number of migrations to display in output. Use `0` to show all migrations.

```bash
export MSR_DISPLAY_LIMIT=20
```

**Programmatic Equivalent:**
```typescript
config.displayLimit = 20;
```

**See Also:**
- [Migration Settings](../../configuration/migration-settings#displaylimit)

---

### MSR_SHOW_BANNER

**Display banner with version information**

- **Type**: `boolean`
- **Default**: `true`
- **Example**: `true`, `false`

Controls whether the application banner (ASCII art with version and handler information) is displayed at startup.

```bash
# Show banner (default)
export MSR_SHOW_BANNER=true

# Hide banner for cleaner output
export MSR_SHOW_BANNER=false
```

**Programmatic Equivalent:**
```typescript
config.showBanner = false;
```

**Use Cases:**
- `true` (default): Discoverable version and handler info for new users
- `false`: Cleaner console output in CI/CD pipelines or when embedding MSR

**When to Disable:**
- CI/CD environments where logs need to be concise
- When embedding MSR as a library in other tools
- Docker containers with centralized logging
- Automated testing scenarios

**See Also:**
- [Migration Settings](../../configuration/migration-settings#showbanner)

---

### MSR_RECURSIVE

**Scan subdirectories recursively**

- **Type**: `boolean`
- **Default**: `true`
- **Example**: `true`, `false`

Controls whether MSR scans subdirectories for migration files or only the top-level folder.

```bash
# Scan subdirectories (default)
export MSR_RECURSIVE=true

# Only scan top-level folder
export MSR_RECURSIVE=false
```

**Programmatic Equivalent:**
```typescript
config.recursive = true;
```

**Use Cases:**
- `true` (default): Organize migrations in subdirectories by module/feature
- `false`: Flat structure with all migrations in one folder

**Directory Structure Example:**
```
migrations/
  ├── users/
  │   ├── V001_create_users.ts
  │   └── V002_add_email_index.ts
  ├── products/
  │   └── V003_create_products.ts
  └── orders/
      └── V004_create_orders.ts
```

**See Also:**
- [Migration Settings](../../configuration/migration-settings#recursive)
- [File Organization](../../guides/writing-migrations#file-organization)

---

### MSR_FILE_PATTERNS

**Migration filename patterns**

- **Type**: `string[]` (JSON array of regex patterns)
- **Default**: `["/^V(\\d{12})_/"]`
- **Example**: `["/^V(\\d+)_/", "/^M(\\d+)_/"]`

Regular expression patterns for discovering migration files. Patterns must capture version number in first group.

```bash
# Single pattern (default)
export MSR_FILE_PATTERNS='["/^V(\\d{12})_/"]'

# Multiple patterns
export MSR_FILE_PATTERNS='["/^V(\\d+)_/", "/^M(\\d+)_/"]'
```

**Programmatic Equivalent:**
```typescript
config.filePatterns = [/^V(\d+)_/, /^M(\d+)_/];
```

**Pattern Requirements:**
- Must be valid JavaScript regex
- First capturing group `(\d+)` must extract version number
- Patterns are tested against filename only, not full path

**Example Patterns:**

| Pattern | Matches | Version Captured |
|---------|---------|------------------|
| `/^V(\d{12})_/` | `V202401151030_create_users.ts` | `202401151030` |
| `/^V(\d+)_/` | `V001_create_users.ts` | `001` |
| `/^(\d+)_/` | `001_create_users.ts` | `001` |
| `/^M_(\d+)_/` | `M_001_migration.ts` | `001` |

**See Also:**
- [Migration Settings](../../configuration/migration-settings#filepatterns)
- [File Naming Conventions](../../guides/writing-migrations#naming-conventions)

---

### MSR_CONFIG_FILE

**Path to configuration file**

- **Type**: `string`
- **Default**: Auto-detected (`msr.config.js`, `msr.config.json`)
- **Example**: `./config/msr.config.js`, `/app/msr-config.json`

Override automatic config file detection with explicit path.

```bash
export MSR_CONFIG_FILE=./config/custom-msr.config.js
```

**Programmatic Equivalent:**
```typescript
const config = ConfigLoader.loadFromFile('./config/custom-msr.config.js');
```

**Auto-Detection Order:**
1. `msr.config.js` in current directory
2. `msr.config.json` in current directory
3. No config file (use defaults)

**See Also:**
- [Configuration Files](../../configuration/#configuration-files)
- [ConfigLoader API](../core-classes#configloader)

---

## Complete Example

Production-ready core configuration:

```bash
# Migration discovery
export MSR_FOLDER=/app/database/migrations
export MSR_RECURSIVE=true
export MSR_FILE_PATTERNS='["/^V(\\d{12})_/"]'

# Schema tracking
export MSR_TABLE_NAME=migration_history
export MSR_BEFORE_MIGRATE_NAME=beforeMigrate

# Display settings
export MSR_DISPLAY_LIMIT=20
export MSR_SHOW_BANNER=true

# Testing (CI/CD only)
export MSR_DRY_RUN=${CI:-false}
```

---

## Source Code

TypeScript enum definition: [`src/model/env/CoreEnvVars.ts`](../../../src/model/env/CoreEnvVars.ts)
