---
layout: default
title: Configuration
nav_order: 3
---

# Configuration
{: .no_toc }

Complete guide to configuring Migration Script Runner.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Config Class

The `Config` class controls the behavior of the migration system.

### Basic Configuration

```typescript
import { Config } from '@migration-script-runner/core';

const config = new Config();
config.folder = './migrations';
config.tableName = 'schema_version';
config.filePattern = /^V(\d+)_(.+)\.ts$/;
```

---

## Configuration Options

### folder

**Type:** `string`
**Default:** `./migrations`

The directory containing migration script files.

```typescript
// Relative path
config.folder = './migrations';

// Absolute path
config.folder = '/Users/username/project/migrations';
```

---

### filePattern

**Type:** `RegExp`
**Default:** `/^V(\d+)_(.+)\.ts$/`

Regular expression pattern for matching migration file names. The pattern must capture:
1. **Timestamp** (group 1): Numeric version identifier
2. **Name** (group 2): Descriptive name

```typescript
// Default pattern matches: V202501220100_initial_setup.ts
config.filePattern = /^V(\d+)_(.+)\.ts$/;

// Custom pattern for JavaScript files
config.filePattern = /^V(\d+)_(.+)\.js$/;

// Custom prefix pattern
config.filePattern = /^MIG_(\d+)_(.+)\.ts$/;
```

#### Valid Examples

- `V202501220100_initial_setup.ts` ✅
- `V20250122_add_users.ts` ✅
- `V1_first_migration.ts` ✅

#### Invalid Examples

- `migration_202501220100.ts` ❌ (doesn't start with V)
- `V202501220100.ts` ❌ (missing name after timestamp)
- `202501220100_setup.ts` ❌ (missing V prefix)

---

### tableName

**Type:** `string`
**Default:** `schema_version`

The name of the database table used to track executed migrations.

```typescript
config.tableName = 'schema_version';

// Or use a custom name
config.tableName = 'migrations_history';
```

The table will store:
- Migration timestamp
- Migration name
- Execution timestamp
- Duration
- Username
- Result

---

### displayLimit

**Type:** `number`
**Default:** `0` (show all)

Limits the number of migrations displayed in console output tables.

```typescript
// Show all migrations
config.displayLimit = 0;

// Show only the last 10 migrations
config.displayLimit = 10;

// Show only the last 50 migrations
config.displayLimit = 50;
```

{: .note }
This only affects display output. All migrations are still tracked internally.

---

### backup

**Type:** `BackupConfig`
**Default:** `new BackupConfig()`

Configuration for the backup system. See [Backup Configuration](#backup-configuration) below.

```typescript
import { BackupConfig } from '@migration-script-runner/core';

config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.deleteBackup = true;
```

---

## Backup Configuration

The `BackupConfig` class controls backup behavior.

### Basic Backup Configuration

```typescript
import { BackupConfig } from '@migration-script-runner/core';

const backupConfig = new BackupConfig();
backupConfig.folder = './backups';
backupConfig.deleteBackup = true;
backupConfig.timestamp = true;
```

---

## Backup Options

### folder

**Type:** `string`
**Default:** `./backups`

Directory where backup files are stored.

```typescript
backupConfig.folder = './backups';
backupConfig.folder = '/var/backups/msr';
```

---

### deleteBackup

**Type:** `boolean`
**Default:** `true`

Whether to automatically delete backup files after successful migrations.

```typescript
// Delete backups after success (recommended)
backupConfig.deleteBackup = true;

// Keep backups for manual review
backupConfig.deleteBackup = false;
```

{: .warning }
Setting `deleteBackup = false` will accumulate backup files over time. Implement your own cleanup strategy if disabled.

---

### timestamp

**Type:** `boolean`
**Default:** `true`

Include timestamp in backup filename.

```typescript
// With timestamp: backup-2025-01-22-01-30-45.bkp
backupConfig.timestamp = true;

// Without timestamp: backup.bkp (will overwrite)
backupConfig.timestamp = false;
```

---

### timestampFormat

**Type:** `string`
**Default:** `YYYY-MM-DD-HH-mm-ss`

Moment.js format string for backup timestamp.

```typescript
// Default format: 2025-01-22-01-30-45
backupConfig.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';

// ISO format: 2025-01-22T01:30:45
backupConfig.timestampFormat = 'YYYY-MM-DDTHH:mm:ss';

// Compact format: 20250122_013045
backupConfig.timestampFormat = 'YYYYMMDD_HHmmss';
```

See [Moment.js format documentation](https://momentjs.com/docs/#/displaying/format/) for all options.

---

### prefix

**Type:** `string`
**Default:** `backup`

Filename prefix for backup files.

```typescript
// Default: backup-2025-01-22-01-30-45.bkp
backupConfig.prefix = 'backup';

// Custom: msr-backup-2025-01-22-01-30-45.bkp
backupConfig.prefix = 'msr-backup';
```

---

### filename

**Type:** `string`
**Default:** `''`

Custom filename component inserted between prefix and timestamp.

```typescript
// Default: backup-2025-01-22-01-30-45.bkp
backupConfig.filename = '';

// Custom: backup-production-2025-01-22-01-30-45.bkp
backupConfig.filename = 'production';
```

---

### suffix

**Type:** `string`
**Default:** `''`

Filename suffix inserted before extension.

```typescript
// Default: backup-2025-01-22-01-30-45.bkp
backupConfig.suffix = '';

// Custom: backup-2025-01-22-01-30-45-v2.bkp
backupConfig.suffix = 'v2';
```

---

### ext

**Type:** `string`
**Default:** `.bkp`

File extension for backup files.

```typescript
// Default
backupConfig.ext = '.bkp';

// Custom extensions
backupConfig.ext = '.backup';
backupConfig.ext = '.json';  // If using JSON serialization
backupConfig.ext = '.sql';   // If using SQL dumps
```

{: .note }
The extension can be specified with or without the leading dot (`.bkp` or `bkp`).

---

## Complete Example

Here's a complete configuration example with all options:

```typescript
import { Config, BackupConfig, MigrationScriptExecutor } from '@migration-script-runner/core';
import { MyDatabaseHandler } from './database-handler';

// Create configuration
const config = new Config();

// Migration settings
config.folder = './database/migrations';
config.filePattern = /^V(\d+)_(.+)\.ts$/;
config.tableName = 'migration_history';
config.displayLimit = 20;

// Backup settings
config.backup = new BackupConfig();
config.backup.folder = './database/backups';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
config.backup.timestampFormat = 'YYYYMMDD-HHmmss';
config.backup.prefix = 'db-backup';
config.backup.filename = 'production';
config.backup.ext = '.json';

// Initialize executor
const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler);

// Run migrations
await executor.migrate();
```

This will create backup files like:
```
./database/backups/db-backup-production-20250122-013045.json
```

---

## Environment-Specific Configuration

Use environment variables for different configurations:

```typescript
const config = new Config();

// Different folders per environment
config.folder = process.env.NODE_ENV === 'production'
  ? './migrations'
  : './migrations-dev';

// Different backup strategies
config.backup.deleteBackup = process.env.NODE_ENV === 'production';

// Environment-specific backup naming
config.backup.filename = process.env.NODE_ENV || 'dev';
```

---

## Next Steps

- [API Reference](api/) - Explore the full API
- [Writing Migrations](guides/writing-migrations) - Best practices for migration scripts
- [Getting Started](getting-started) - Set up your first migration
