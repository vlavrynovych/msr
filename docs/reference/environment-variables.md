---
layout: default
title: Environment Variables
parent: Reference
nav_order: 1
---

# Environment Variables Reference
{: .no_toc }

Complete reference of all MSR environment variables
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

All Migration Script Runner environment variables use the `MSR_` prefix. This reference provides a complete list of supported variables with their types, default values, and descriptions.

**See Also:**
- [Environment Variables User Guide](../user-guides/environment-variables) - How-to guide with examples
- [Configuration Overview](../configuration/) - Config class documentation
- [ConfigLoader API](../api/ConfigLoader) - API reference

### Type-Safe Access

MSR provides an [`EnvironmentVariables`](../../src/model/EnvironmentVariables.ts) enum for type-safe access to all environment variable names:

```typescript
import { EnvironmentVariables as ENV } from '@migration-script-runner/core';

// Type-safe access with auto-completion
const folder = process.env[ENV.MSR_FOLDER];
const dryRun = process.env[ENV.MSR_DRY_RUN];
```

This enum is used internally by `ConfigLoader` and provides compile-time checking, auto-completion, and refactoring support when working with environment variables.

---

## Simple Configuration Properties

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `MSR_FOLDER` | string | `./migrations` | Directory containing migration files |
| `MSR_TABLE_NAME` | string | `schema_version` | Name of the schema version tracking table |
| `MSR_BEFORE_MIGRATE_NAME` | string | `beforeMigrate` | Name of the beforeMigrate hook function |
| `MSR_DRY_RUN` | boolean | `false` | Run in dry-run mode (no actual changes) |
| `MSR_DISPLAY_LIMIT` | number | `0` | Maximum number of migrations to display (0 = all) |
| `MSR_RECURSIVE` | boolean | `true` | Recursively scan subdirectories for migrations |
| `MSR_VALIDATE_BEFORE_RUN` | boolean | `true` | Validate migrations before execution |
| `MSR_STRICT_VALIDATION` | boolean | `false` | Treat validation warnings as errors |

---

## File Patterns

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `MSR_FILE_PATTERNS` | JSON array | `["^V(\\d{12})_"]` | Array of regex patterns for migration file matching |

**Example:**
```bash
export MSR_FILE_PATTERNS='["^V(\\d+)_.*\\.ts$","^V(\\d+)_.*\\.sql$"]'
```

**Format:** JSON array of regex pattern strings

---

## Logging Configuration

All logging variables use the `MSR_LOGGING_` prefix.

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `MSR_LOGGING` | JSON object | - | Complete logging configuration as JSON (alternative to dot-notation) |
| `MSR_LOGGING_ENABLED` | boolean | `false` | Enable file logging |
| `MSR_LOGGING_PATH` | string | `./migrations-logs` | Directory for log files |
| `MSR_LOGGING_MAX_FILES` | number | `10` | Maximum number of log files to retain |
| `MSR_LOGGING_TIMESTAMP_FORMAT` | string | `YYYY-MM-DD` | Moment.js format for log timestamps |
| `MSR_LOGGING_LOG_SUCCESSFUL` | boolean | `false` | Log successful migrations (in addition to failures) |

**JSON Example:**
```bash
export MSR_LOGGING='{"enabled":true,"path":"./logs","maxFiles":30}'
```

**Dot-Notation Example (Recommended):**
```bash
export MSR_LOGGING_ENABLED=true
export MSR_LOGGING_PATH=./logs
export MSR_LOGGING_MAX_FILES=30
```

**Note:** Dot-notation variables take precedence over JSON if both are set.

---

## Backup Configuration

All backup variables use the `MSR_BACKUP_` prefix.

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `MSR_BACKUP` | JSON object | - | Complete backup configuration as JSON (alternative to dot-notation) |
| `MSR_BACKUP_TIMESTAMP` | boolean | `true` | Include timestamp in backup filename |
| `MSR_BACKUP_DELETE_BACKUP` | boolean | `true` | Delete backup after successful migration |
| `MSR_BACKUP_FOLDER` | string | `./backups` | Directory for backup files |
| `MSR_BACKUP_PREFIX` | string | `backup` | Filename prefix for backups |
| `MSR_BACKUP_CUSTOM` | string | `''` | Custom component for backup filename |
| `MSR_BACKUP_SUFFIX` | string | `''` | Suffix component for backup filename |
| `MSR_BACKUP_TIMESTAMP_FORMAT` | string | `YYYY-MM-DD-HH-mm-ss` | Moment.js format for backup timestamps |
| `MSR_BACKUP_EXTENSION` | string | `bkp` | File extension for backup files (without dot) |
| `MSR_BACKUP_EXISTING_BACKUP_PATH` | string | `undefined` | Path to existing backup for restore operations |

**JSON Example:**
```bash
export MSR_BACKUP='{"folder":"./backups","timestamp":true,"deleteBackup":true}'
```

**Dot-Notation Example (Recommended):**
```bash
export MSR_BACKUP_FOLDER=./backups
export MSR_BACKUP_TIMESTAMP=true
export MSR_BACKUP_DELETE_BACKUP=true
export MSR_BACKUP_PREFIX=db-backup
```

---

## Transaction Configuration

All transaction variables use the `MSR_TRANSACTION_` prefix.

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `MSR_TRANSACTION` | JSON object | - | Complete transaction configuration as JSON (alternative to dot-notation) |
| `MSR_TRANSACTION_MODE` | string | `PER_MIGRATION` | Transaction boundary scope: `PER_MIGRATION`, `PER_BATCH`, or `NONE` |
| `MSR_TRANSACTION_ISOLATION` | string | `READ_COMMITTED` | SQL isolation level: `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, or `SERIALIZABLE` |
| `MSR_TRANSACTION_TIMEOUT` | number | `30000` | Transaction timeout in milliseconds |
| `MSR_TRANSACTION_RETRIES` | number | `3` | Number of retry attempts for transient failures (deadlocks, serialization) |
| `MSR_TRANSACTION_RETRY_DELAY` | number | `100` | Base delay between retries in milliseconds |
| `MSR_TRANSACTION_RETRY_BACKOFF` | boolean | `true` | Use exponential backoff for retries |

**JSON Example:**
```bash
export MSR_TRANSACTION='{"mode":"PER_MIGRATION","isolation":"READ_COMMITTED","retries":3}'
```

**Dot-Notation Example (Recommended):**
```bash
export MSR_TRANSACTION_MODE=PER_MIGRATION
export MSR_TRANSACTION_ISOLATION=READ_COMMITTED
export MSR_TRANSACTION_TIMEOUT=30000
export MSR_TRANSACTION_RETRIES=3
export MSR_TRANSACTION_RETRY_DELAY=100
export MSR_TRANSACTION_RETRY_BACKOFF=true
```

**Transaction Modes:**
- `PER_MIGRATION` - Each migration in its own transaction (default, recommended)
- `PER_BATCH` - All migrations in a single transaction (all-or-nothing)
- `NONE` - No automatic transactions (for NoSQL or custom transaction logic)

**Isolation Levels:**
- `READ_UNCOMMITTED` - Lowest isolation, allows dirty reads
- `READ_COMMITTED` - Default, prevents dirty reads (recommended)
- `REPEATABLE_READ` - Prevents non-repeatable reads
- `SERIALIZABLE` - Highest isolation, full serializability

See [Transaction Configuration](../configuration/transaction-settings.md) for detailed information.

---

## Config File Location

| Environment Variable | Type | Default | Description |
|---------------------|------|---------|-------------|
| `MSR_CONFIG_FILE` | string | - | Path to custom config file (overrides default msr.config.js/json search) |

**Example:**
```bash
export MSR_CONFIG_FILE=./config/production.config.js
```

**Priority:**
1. `MSR_CONFIG_FILE` (if set)
2. `./msr.config.js` (if exists)
3. `./msr.config.json` (if exists)

---

## Boolean Value Format

Boolean environment variables accept multiple formats (case-insensitive):

**Truthy Values:**
- `true`
- `1`
- `yes`
- `on`

**Falsy Values:**
- Everything else (including `false`, `0`, `no`, `off`, empty string)

**Examples:**
```bash
export MSR_DRY_RUN=true       # ✅ true
export MSR_DRY_RUN=TRUE       # ✅ true (case-insensitive)
export MSR_DRY_RUN=1          # ✅ true
export MSR_DRY_RUN=yes        # ✅ true

export MSR_DRY_RUN=false      # ✅ false
export MSR_DRY_RUN=0          # ✅ false
export MSR_DRY_RUN=anything   # ✅ false
```

---

## Number Value Format

Number environment variables are parsed as floats:

```bash
export MSR_DISPLAY_LIMIT=20        # ✅ 20
export MSR_LOGGING_MAX_FILES=30    # ✅ 30
export MSR_DISPLAY_LIMIT=3.14      # ✅ 3.14 (floats supported)
```

**Invalid numbers return NaN** with a console warning.

---

## Nested Object Format

Nested configuration objects can be set using two approaches:

### Dot-Notation (Recommended)

Property names are converted from camelCase to SNAKE_CASE:

| Config Property | Environment Variable |
|----------------|---------------------|
| `logging.enabled` | `MSR_LOGGING_ENABLED` |
| `logging.maxFiles` | `MSR_LOGGING_MAX_FILES` |
| `backup.deleteBackup` | `MSR_BACKUP_DELETE_BACKUP` |
| `backup.timestampFormat` | `MSR_BACKUP_TIMESTAMP_FORMAT` |

**Conversion Rules:**
- `camelCase` → `SNAKE_CASE`
- `maxFiles` → `MAX_FILES`
- `deleteBackup` → `DELETE_BACKUP`
- `timestampFormat` → `TIMESTAMP_FORMAT`

### JSON Format (Alternative)

```bash
# Logging
export MSR_LOGGING='{"enabled":true,"path":"./logs","maxFiles":30}'

# Backup
export MSR_BACKUP='{"folder":"./backups","timestamp":true,"deleteBackup":true}'
```

**Important:** If both dot-notation and JSON are set, dot-notation variables take precedence.

---

## Configuration Priority

Environment variables are applied in a waterfall with this priority (highest last):

```
1. Built-in defaults (Config class)
   ↓
2. Config file (msr.config.js/json)
   ↓
3. Environment variables (MSR_*)
   ↓
4. Constructor overrides
```

**Example:**
```typescript
// Built-in default
Config.folder = './migrations'

// Overridden by config file
msr.config.js: { folder: './db/migrations' }

// Overridden by environment variable
MSR_FOLDER=./database/migrations

// Overridden by constructor
new MigrationScriptExecutor(handler, { folder: './custom' })
// Result: './custom' (highest priority)
```

---

## Platform-Specific Examples

### Docker

```dockerfile
ENV MSR_FOLDER=/app/migrations
ENV MSR_TABLE_NAME=migration_history
ENV MSR_LOGGING_ENABLED=true
ENV MSR_BACKUP_FOLDER=/app/backups
```

### Kubernetes ConfigMap

```yaml
data:
  MSR_FOLDER: "/app/migrations"
  MSR_TABLE_NAME: "migration_history"
  MSR_LOGGING_ENABLED: "true"
  MSR_BACKUP_FOLDER: "/mnt/backups"
```

### Docker Compose

```yaml
environment:
  - MSR_FOLDER=/app/migrations
  - MSR_TABLE_NAME=migration_history
  - MSR_LOGGING_ENABLED=true
  - MSR_BACKUP_FOLDER=/app/backups
```

### GitHub Actions

```yaml
env:
  MSR_FOLDER: ./migrations
  MSR_STRICT_VALIDATION: true
  MSR_LOGGING_ENABLED: true
```

### .env File

```bash
MSR_FOLDER=./database/migrations
MSR_TABLE_NAME=migration_history
MSR_LOGGING_ENABLED=true
MSR_LOGGING_PATH=./logs
MSR_BACKUP_FOLDER=./backups
```

---

## Quick Reference Table

### By Category

#### Basic Settings
- `MSR_FOLDER`
- `MSR_TABLE_NAME`
- `MSR_BEFORE_MIGRATE_NAME`

#### Behavior Flags
- `MSR_DRY_RUN`
- `MSR_RECURSIVE`
- `MSR_VALIDATE_BEFORE_RUN`
- `MSR_STRICT_VALIDATION`

#### Display
- `MSR_DISPLAY_LIMIT`

#### File Matching
- `MSR_FILE_PATTERNS`

#### Logging (MSR_LOGGING_*)
- `ENABLED`
- `PATH`
- `MAX_FILES`
- `TIMESTAMP_FORMAT`
- `LOG_SUCCESSFUL`

#### Backup (MSR_BACKUP_*)
- `FOLDER`
- `TIMESTAMP`
- `DELETE_BACKUP`
- `PREFIX`
- `CUSTOM`
- `SUFFIX`
- `TIMESTAMP_FORMAT`
- `EXTENSION`
- `EXISTING_BACKUP_PATH`

---

## See Also

- **[Environment Variables User Guide](../user-guides/environment-variables)** - How-to guide with platform examples
- **[Configuration Overview](../configuration/)** - Config class documentation
- **[ConfigLoader API](../api/ConfigLoader)** - API reference
- **[Getting Started](../getting-started)** - Quick start guide

---

## Migration from v0.4.x

**New in v0.5.0:** All environment variables listed on this page.

**Before (v0.4.x):**
```typescript
// Manual configuration only
const config = new Config();
config.folder = process.env.MIGRATION_FOLDER || './migrations';
config.tableName = process.env.TABLE_NAME || 'schema_version';

const executor = new MigrationScriptExecutor(handler, config);
```

**After (v0.5.0+):**
```bash
# Set environment variables
export MSR_FOLDER=./migrations
export MSR_TABLE_NAME=schema_version
```

```typescript
// Automatic loading - no config needed!
const executor = new MigrationScriptExecutor(handler);
```

See [Migration Guide v0.4 → v0.5](../version-migration/v0.4-to-v0.5) for complete upgrade instructions.
