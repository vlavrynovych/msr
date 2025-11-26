---
layout: default
title: Migration Settings
parent: Configuration
nav_order: 1
---

# Migration Settings
{: .no_toc }

Configure migration file discovery and tracking
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Migration settings control how MSR discovers, loads, and tracks migration scripts. These settings determine:

- Where migration files are located
- Which files are recognized as migrations
- How migrations are tracked in the database
- How many migrations are displayed in output

---

## folder

**Type:** `string`
**Default:** `./migrations`

The directory containing migration script files.

```typescript
// Relative path (relative to current working directory)
config.folder = './migrations';

// Absolute path
config.folder = '/Users/username/project/migrations';

// Environment-specific
config.folder = process.env.MIGRATION_FOLDER || './migrations';
```

### Examples

```typescript
// Standard location
config.folder = './migrations';

// Nested location
config.folder = './database/migrations';

// Shared location
config.folder = '../shared/migrations';
```

{: .note }
The folder must exist before running migrations. MSR will not create it automatically.

---

## filePattern

**Type:** `RegExp`
**Default:** `/^V(\d{12})_/`

Regular expression pattern for matching migration file names. The pattern must capture two groups:
1. **Timestamp** (group 1): Numeric version identifier
2. **Name** (group 2): Descriptive name

```typescript
// Default pattern matches: V202501220100_initial_setup.ts
config.filePattern = /^V(\d+)_(.+)\.ts$/;

// Custom pattern for JavaScript files
config.filePattern = /^V(\d+)_(.+)\.js$/;

// Custom prefix
config.filePattern = /^MIG_(\d+)_(.+)\.ts$/;

// Different format
config.filePattern = /^(\d+)[-_](.+)\.ts$/;
```

### Pattern Requirements

The regex **must** have exactly 2 capture groups:

```typescript
// ✅ Valid - 2 capture groups
/^V(\d+)_(.+)\.ts$/
//   ^^^^^ ^^^^
//   group1 group2

// ❌ Invalid - only 1 capture group
/^V\d+_(.+)\.ts$/

// ❌ Invalid - 3 capture groups
/^V(\d+)_(.+)_(.+)\.ts$/
```

### Valid Examples

With default pattern `/^V(\d+)_(.+)\.ts$/`:

- `V202501220100_initial_setup.ts` ✅
- `V20250122_add_users.ts` ✅
- `V1_first_migration.ts` ✅
- `V000000000001_test.ts` ✅

### Invalid Examples

- `migration_202501220100.ts` ❌ (doesn't start with V)
- `V202501220100.ts` ❌ (missing name after timestamp)
- `202501220100_setup.ts` ❌ (missing V prefix)
- `V202501220100_setup.js` ❌ (wrong extension with .ts pattern)

### Custom Patterns

```typescript
// JavaScript files
config.filePattern = /^V(\d+)_(.+)\.js$/;

// Both TypeScript and JavaScript
config.filePattern = /^V(\d+)_(.+)\.(ts|js)$/;
// Note: Use first capture group for timestamp, need to adjust if using this pattern

// Underscore prefix
config.filePattern = /^_(\d+)_(.+)\.ts$/;

// Date-based: YYYYMMDD format
config.filePattern = /^(\d{8})_(.+)\.ts$/;
// Example: 20250122_create_users.ts
```

{: .warning }
Changing `filePattern` after migrations have run may cause MSR to not recognize previously executed migrations.

---

## tableName

**Type:** `string`
**Default:** `'schema_version'`

The name of the database table used to track executed migrations.

```typescript
config.tableName = 'schema_version';

// Or use a custom name
config.tableName = 'migrations_history';
config.tableName = 'db_migrations';
config.tableName = 'applied_scripts';
```

### Table Schema

The table stores:

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | number | Migration timestamp (from filename) |
| `name` | string | Migration file name |
| `executed_at` | timestamp | When migration was executed |
| `duration` | number | Execution time in milliseconds |
| `username` | string | User who ran the migration |
| `result` | string | Return value from up() method |
| `checksum` | string | File checksum for integrity checking |

### Examples

```typescript
// Standard name
config.tableName = 'schema_version';

// Prefixed for multi-app database
config.tableName = 'myapp_migrations';

// Environment-specific
config.tableName = process.env.MIGRATION_TABLE || 'schema_version';
```

{: .note }
The table is created automatically on first run if it doesn't exist.

---

## displayLimit

**Type:** `number`
**Default:** `0` (show all)

Limits the number of migrations displayed in console output tables.

```typescript
// Show all migrations (default)
config.displayLimit = 0;

// Show only the last 10 migrations
config.displayLimit = 10;

// Show only the last 50 migrations
config.displayLimit = 50;
```

### Behavior

- Affects **console output only**
- All migrations are still tracked in the database
- Useful for projects with many migrations
- Keeps console output manageable

### Example Output

```
With displayLimit = 5:

+--------+----------+---------------------------+
|   ...  | (45 more migrations not shown)      |
+--------+----------+---------------------------+
| V00046 | migration_46 | 2025-01-20 10:00:00 |
| V00047 | migration_47 | 2025-01-20 11:00:00 |
| V00048 | migration_48 | 2025-01-20 12:00:00 |
| V00049 | migration_49 | 2025-01-20 13:00:00 |
| V00050 | migration_50 | 2025-01-20 14:00:00 |
+--------+----------+---------------------------+
```

### Use Cases

```typescript
// Development - show all
config.displayLimit = 0;

// Staging - show recent 20
config.displayLimit = 20;

// Production - show recent 10
config.displayLimit = 10;

// CI/CD - show all
config.displayLimit = 0;
```

{: .note }
This only affects display output. All migrations are still tracked internally and shown in JSON output mode.

---

## beforeMigrateName

**Type:** `string | null`
**Default:** `'beforeMigrate'`

Name of the special setup script that executes before any migrations.

```typescript
// Default: looks for beforeMigrate.ts or beforeMigrate.js
config.beforeMigrateName = 'beforeMigrate';

// Custom name: looks for setup.ts or setup.js
config.beforeMigrateName = 'setup';

// Disable beforeMigrate entirely
config.beforeMigrateName = null;
```

### Behavior

- Executes **before** scanning for migrations
- NOT saved to the schema version table
- Can be TypeScript (.ts) or JavaScript (.js)
- Must implement `IRunnableScript` interface
- Located in the migrations folder

### Example: beforeMigrate.ts

```typescript
// migrations/beforeMigrate.ts
import {
    IRunnableScript,
    IMigrationInfo,
    IDatabaseMigrationHandler,
    IDB
} from 'migration-script-runner';

export default class BeforeMigrate implements IRunnableScript {
    async up(
        db: IDB,
        info: IMigrationInfo,
        handler: IDatabaseMigrationHandler
    ): Promise<string> {
        // Load production snapshot
        await db.execute('DROP SCHEMA IF EXISTS public CASCADE');
        await db.execute('CREATE SCHEMA public');
        await this.loadSnapshot(db);

        return 'Database reset with snapshot';
    }

    private async loadSnapshot(db: IDB): Promise<void> {
        // Load SQL dump
        const snapshot = fs.readFileSync('./snapshots/prod.sql', 'utf-8');
        await db.execute(snapshot);
    }
}
```

### Use Cases

**Data Seeding:**
```typescript
// Load test data before running migrations
export default class BeforeMigrate implements IRunnableScript {
    async up(db, info, handler): Promise<string> {
        await db.execute(`INSERT INTO users VALUES (1, 'admin')`);
        return 'Test data loaded';
    }
}
```

**Fresh Database Setup:**
```typescript
// Create extensions on new databases
export default class BeforeMigrate implements IRunnableScript {
    async up(db, info, handler): Promise<string> {
        await db.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        await db.execute('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
        return 'Extensions created';
    }
}
```

**Environment-Specific Setup:**
```typescript
// Set database parameters
export default class BeforeMigrate implements IRunnableScript {
    async up(db, info, handler): Promise<string> {
        if (process.env.NODE_ENV === 'development') {
            await db.execute('SET statement_timeout = 0');
        }
        return 'Environment configured';
    }
}
```

**Validation:**
```typescript
// Check database version
export default class BeforeMigrate implements IRunnableScript {
    async up(db, info, handler): Promise<string> {
        const result = await db.execute('SELECT version()');
        const version = parseVersion(result);

        if (version.major < 13) {
            throw new Error('PostgreSQL 13+ required');
        }

        return 'Version check passed';
    }
}
```

{: .note }
The beforeMigrate script executes **before** MSR scans for migrations, allowing it to completely reset/erase the database.

{: .warning }
beforeMigrate can erase your database. Only use in development/testing or with proper safeguards.

---

## recursive

**Type:** `boolean`
**Default:** `true`

Enable recursive scanning of sub-folders for migration scripts.

```typescript
// Recursive mode - scan all sub-folders (default)
config.recursive = true;

// Single-folder mode - scan only the root folder
config.recursive = false;
```

### Behavior

- **When `true`**: MSR scans all sub-directories recursively
- **When `false`**: MSR only scans the root `folder` directory
- **Execution order**: Always by timestamp, regardless of folder structure
- **Hidden folders**: Automatically excluded (folders starting with `.`)

### Use Cases

**By Feature/Module:**
```
migrations/
├── users/
│   ├── V202501220100_create_users_table.ts
│   └── V202501230200_add_user_roles.ts
├── auth/
│   └── V202501220150_create_sessions_table.ts
└── products/
    └── V202501240100_create_products_table.ts
```

**By Version:**
```
migrations/
├── v1.0/
│   └── V202501010000_initial_schema.ts
├── v1.1/
│   └── V202501150000_add_features.ts
└── v2.0/
    └── V202502010000_major_refactor.ts
```

**By Type:**
```
migrations/
├── schema/
│   ├── V202501220100_create_tables.ts
│   └── V202501220200_add_indexes.ts
├── data/
│   └── V202501230100_seed_data.ts
└── hotfix/
    └── V202501240100_fix_bug.ts
```

### Execution Order

Migrations **always** execute in timestamp order, regardless of folder:

```
Folder structure:
  migrations/
  ├── users/V202501220100_create_users.ts
  ├── auth/V202501220150_create_sessions.ts
  ├── users/V202501230200_add_roles.ts
  └── products/V202501240100_create_products.ts

Execution order (by timestamp):
  1. V202501220100_create_users.ts (users/)
  2. V202501220150_create_sessions.ts (auth/)
  3. V202501230200_add_roles.ts (users/)
  4. V202501240100_create_products.ts (products/)
```

### Excluded Folders

These folders are automatically excluded from scanning:

- Hidden folders (starting with `.`)
  - `.git/`
  - `.vscode/`
  - `.idea/`
- `node_modules/` (if in migration folder)

{: .note }
Hidden files and folders (starting with `.`) are automatically excluded from scanning.

---

## Complete Example

```typescript
import { Config, MigrationScriptExecutor } from '@migration-script-runner/core';

const config = new Config();

// Migration discovery
config.folder = './database/migrations';
config.filePattern = /^V(\d+)_(.+)\.ts$/;
config.recursive = true;

// Migration tracking
config.tableName = 'migration_history';
config.displayLimit = 20;

// Setup script
config.beforeMigrateName = 'beforeMigrate';

// Initialize and run
const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

---

## Environment-Specific Settings

```typescript
const config = new Config();

// Different folders per environment
config.folder = process.env.MIGRATION_FOLDER || './migrations';

// Different table names
config.tableName = `${process.env.APP_NAME}_migrations`;

// Display limit based on environment
config.displayLimit = process.env.NODE_ENV === 'production' ? 10 : 0;

// Conditional beforeMigrate
config.beforeMigrateName = process.env.NODE_ENV === 'development'
    ? 'beforeMigrate'
    : null;
```

---

## Best Practices

### 1. Use Consistent Folder Structure

```typescript
// ✅ Good - clear structure
migrations/
├── beforeMigrate.ts
├── schema/
│   └── V202501220100_create_tables.ts
└── data/
    └── V202501230100_seed_data.ts

// ❌ Bad - mixed organization
migrations/
├── V1_something.ts
├── temp/old/V2_other.ts
└── new_V3_thing.ts
```

### 2. Keep Pattern Simple

```typescript
// ✅ Good - simple, standard pattern
config.filePattern = /^V(\d+)_(.+)\.ts$/;

// ❌ Bad - overly complex
config.filePattern = /^(?:V|MIG|VERSION)_?(\d+)[-_](.+)\.(ts|js|mjs)$/;
```

### 3. Use Descriptive Table Names

```typescript
// ✅ Good - clear purpose
config.tableName = 'schema_version';
config.tableName = 'migration_history';

// ❌ Bad - unclear
config.tableName = 'meta';
config.tableName = 'versions';
```

### 4. Set Reasonable Display Limits

```typescript
// ✅ Good - balance between visibility and readability
config.displayLimit = process.env.NODE_ENV === 'production' ? 10 : 20;

// ❌ Bad - too restrictive
config.displayLimit = 1;  // Can't see recent history
```

---

## Related Documentation

- [Configuration Overview](index) - All configuration options
- [Validation Settings](validation-settings) - Validation configuration
- [Rollback Settings](rollback-settings) - Rollback strategies
- [Writing Migrations](../guides/writing-migrations) - Migration best practices
