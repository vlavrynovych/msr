---
layout: default
title: Environment Variables
parent: API Reference
nav_order: 7
has_children: true
---

# Environment Variables
{: .no_toc }

Configure Migration Script Runner using environment variables following [12-Factor App](https://12factor.net/config) principles.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR supports comprehensive configuration through `MSR_*` environment variables, making it ideal for containerized deployments, CI/CD pipelines, and production environments.

**Key Benefits:**
- **12-Factor Compliant**: Separate config from code
- **Docker/Kubernetes Ready**: Perfect for container orchestration
- **CI/CD Friendly**: No config files to manage
- **Type-Safe**: TypeScript enums for all variables

---

## Quick Reference

All MSR environment variables grouped by category:

### Core Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MSR_FOLDER` | `string` | `./migrations` | Migration files directory |
| `MSR_TABLE_NAME` | `string` | `schema_version` | Schema version tracking table |
| `MSR_BEFORE_MIGRATE_NAME` | `string` | `beforeMigrate` | Name of setup function |
| `MSR_DRY_RUN` | `boolean` | `false` | Test migrations without committing |
| `MSR_DISPLAY_LIMIT` | `number` | `0` | Limit displayed migrations (0 = all) |
| `MSR_RECURSIVE` | `boolean` | `true` | Scan subdirectories recursively |
| `MSR_FILE_PATTERNS` | `string[]` | `[/^V(\d{12})_/]` | Migration filename patterns (JSON array) |
| `MSR_CONFIG_FILE` | `string` | Auto-detected | Path to config file |

**[→ Core Configuration Details](core-variables)**

### Validation

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MSR_VALIDATE_BEFORE_RUN` | `boolean` | `true` | Validate before execution |
| `MSR_STRICT_VALIDATION` | `boolean` | `false` | Treat warnings as errors |

**[→ Validation Details](validation-variables)**

### Logging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MSR_LOGGING` | `JSON` | - | Complete logging config (alternative to dot-notation) |
| `MSR_LOGGING_ENABLED` | `boolean` | `false` | Enable file logging |
| `MSR_LOGGING_PATH` | `string` | `./migrations-logs` | Log file directory |
| `MSR_LOGGING_MAX_FILES` | `number` | `10` | Maximum log files to retain |
| `MSR_LOGGING_TIMESTAMP_FORMAT` | `string` | `YYYY-MM-DD` | Log timestamp format |
| `MSR_LOGGING_LOG_SUCCESSFUL` | `boolean` | `false` | Log successful migrations |

**[→ Logging Details](logging-variables)**

### Backup & Restore

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MSR_BACKUP` | `JSON` | - | Complete backup config (alternative to dot-notation) |
| `MSR_BACKUP_TIMESTAMP` | `boolean` | `true` | Include timestamp in filename |
| `MSR_BACKUP_DELETE_BACKUP` | `boolean` | `true` | Delete after successful migration |
| `MSR_BACKUP_FOLDER` | `string` | `./backups` | Backup files directory |
| `MSR_BACKUP_PREFIX` | `string` | `backup` | Filename prefix |
| `MSR_BACKUP_CUSTOM` | `string` | `''` | Custom filename component |
| `MSR_BACKUP_SUFFIX` | `string` | `''` | Filename suffix |
| `MSR_BACKUP_TIMESTAMP_FORMAT` | `string` | `YYYY-MM-DD-HH-mm-ss` | Timestamp format |
| `MSR_BACKUP_EXTENSION` | `string` | `bkp` | File extension (no dot) |
| `MSR_BACKUP_EXISTING_BACKUP_PATH` | `string` | - | Path for restore operations |

**[→ Backup Details](backup-variables)**

### Transaction Management

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MSR_TRANSACTION` | `JSON` | - | Complete transaction config (alternative to dot-notation) |
| `MSR_TRANSACTION_MODE` | `string` | `PER_MIGRATION` | Transaction scope (PER_MIGRATION, PER_BATCH, NONE) |
| `MSR_TRANSACTION_ISOLATION` | `string` | `READ_COMMITTED` | SQL isolation level |
| `MSR_TRANSACTION_TIMEOUT` | `number` | `30000` | Transaction timeout (ms) |
| `MSR_TRANSACTION_RETRIES` | `number` | `3` | Retry attempts on transient failures |
| `MSR_TRANSACTION_RETRY_DELAY` | `number` | `100` | Initial retry delay (ms) |
| `MSR_TRANSACTION_RETRY_BACKOFF` | `boolean` | `true` | Use exponential backoff |

**[→ Transaction Details](transaction-variables)**

---

## Usage Patterns

### Simple Configuration

```bash
export MSR_FOLDER=./database/migrations
export MSR_TABLE_NAME=migration_history
export MSR_LOGGING_ENABLED=true
```

### JSON Configuration

For complex objects, use JSON format:

```bash
# Backup configuration
export MSR_BACKUP='{"folder":"./backups","timestamp":true,"deleteBackup":false}'

# Logging configuration
export MSR_LOGGING='{"enabled":true,"path":"./logs","maxFiles":30}'

# Transaction configuration
export MSR_TRANSACTION='{"mode":"PER_BATCH","isolation":"SERIALIZABLE","retries":5}'
```

### Docker Configuration

```dockerfile
ENV MSR_FOLDER=/app/migrations \
    MSR_TABLE_NAME=schema_version \
    MSR_LOGGING_ENABLED=true \
    MSR_LOGGING_PATH=/var/log/migrations \
    MSR_BACKUP_FOLDER=/var/backups
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: msr-config
data:
  MSR_FOLDER: "/app/migrations"
  MSR_TABLE_NAME: "schema_version"
  MSR_LOGGING_ENABLED: "true"
  MSR_TRANSACTION_MODE: "PER_MIGRATION"
  MSR_TRANSACTION_RETRIES: "5"
```

---

## TypeScript API

Environment variable names are available as TypeScript enums:

```typescript
import {
  CoreEnvVars,
  ValidationEnvVars,
  LoggingEnvVars,
  BackupEnvVars,
  TransactionEnvVars,
  ENV
} from '@migration-script-runner/core';

// Use specific enum
process.env[CoreEnvVars.MSR_FOLDER] = './migrations';
process.env[ValidationEnvVars.MSR_STRICT_VALIDATION] = 'true';
process.env[TransactionEnvVars.MSR_TRANSACTION_MODE] = 'PER_BATCH';

// Or use unified ENV constant
process.env[ENV.MSR_FOLDER] = './migrations';
process.env[ENV.MSR_LOGGING_ENABLED] = 'true';
```

**Source:** [`src/model/env/index.ts`](../../../src/model/env/index.ts)

---

## Configuration Priority

Environment variables are part of MSR's waterfall configuration system:

1. **Built-in defaults** - From `Config` class
2. **Config file** - `msr.config.js` or `msr.config.json`
3. **Environment variables** - `MSR_*` variables (highest priority)
4. **Constructor overrides** - Direct `Config` object

---

## Category Details

Explore detailed documentation for each category:

- **[Core Configuration](core-variables)** - Basic settings and file discovery
- **[Validation Settings](validation-variables)** - Migration validation rules
- **[Logging Configuration](logging-variables)** - File logging and audit trails
- **[Backup & Restore](backup-variables)** - Backup file management
- **[Transaction Management](transaction-variables)** - Transaction control and retry logic (v0.5.0+)

---

## Related Documentation

- **[Configuration Guide](../../configuration/)** - Complete configuration reference
- **[ConfigLoader API](../core-classes#configloader)** - Programmatic config loading
- **[Getting Started](../../getting-started)** - Quick start guide
