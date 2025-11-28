---
layout: default
title: Configuration
nav_order: 3
has_children: true
---

# Configuration
{: .no_toc }

Complete guide to configuring Migration Script Runner
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Migration Script Runner uses the `Config` class to control all aspects of migration behavior. Configuration is organized into several categories:

- **[Migration Settings](migration-settings)** - File paths, patterns, and script discovery
- **[Validation Settings](validation-settings)** - Validation rules and policies
- **[Rollback Settings](rollback-settings)** - Rollback strategies and behavior
- **[Backup Settings](backup-settings)** - Backup configuration for BACKUP strategy

---

## Quick Start

### Basic Configuration

```typescript
import { Config, MigrationScriptExecutor } from '@migration-script-runner/core';
import { MyDatabaseHandler } from './database-handler';

// Create configuration
const config = new Config();

// Set migration folder
config.folder = './migrations';

// Initialize and run
const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler, config);

await executor.migrate();
```

---

## Config Class

The `Config` class controls the behavior of the migration system.

### Creating a Config

```typescript
import { Config } from '@migration-script-runner/core';

const config = new Config();
```

### Config Categories

| Category | Properties | Description |
|----------|-----------|-------------|
| [Migration Settings](migration-settings) | `folder`, `filePattern`, `tableName`, `displayLimit`, `beforeMigrateName`, `recursive` | Control how migrations are discovered and tracked |
| [Validation Settings](validation-settings) | `validateBeforeRun`, `strictValidation`, `downMethodPolicy`, `customValidators` | Control validation behavior and rules |
| [Rollback Settings](rollback-settings) | `rollbackStrategy` | Choose backup, down(), both, or none |
| [Backup Settings](backup-settings) | `backup` (BackupConfig) | Configure backup file naming and storage |

---

## Configuration Workflow

### 1. Choose Your Rollback Strategy

Start by deciding how you want to handle rollback:

```typescript
import { RollbackStrategy } from '@migration-script-runner/core';

// Option 1: Backup/restore (default)
config.rollbackStrategy = RollbackStrategy.BACKUP;

// Option 2: Use down() methods
config.rollbackStrategy = RollbackStrategy.DOWN;

// Option 3: Try down() first, fallback to backup
config.rollbackStrategy = RollbackStrategy.BOTH;

// Option 4: No rollback (development only)
config.rollbackStrategy = RollbackStrategy.NONE;
```

See [Rollback Settings](rollback-settings) for detailed comparison.

### 2. Configure Migration Discovery

Set where and how to find migration files:

```typescript
// Migration folder
config.folder = './database/migrations';

// File pattern
config.filePattern = /^V(\d+)_(.+)\.ts$/;

// Enable recursive scanning
config.recursive = true;
```

See [Migration Settings](migration-settings) for all options.

### 3. Configure Validation

Control validation behavior:

```typescript
import { DownMethodPolicy } from '@migration-script-runner/core';

// Enable validation (recommended)
config.validateBeforeRun = true;

// Choose down() policy based on rollback strategy
config.downMethodPolicy = DownMethodPolicy.AUTO;

// Add custom validators
config.customValidators = [new MyValidator()];
```

See [Validation Settings](validation-settings) for validation options.

### 4. Configure Backup (if using BACKUP strategy)

If using `BACKUP` or `BOTH` strategies:

```typescript
import { BackupConfig } from '@migration-script-runner/core';

config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.deleteBackup = true;
```

See [Backup Settings](backup-settings) for backup options.

---

## Complete Example

Production-ready configuration:

```typescript
import {
    Config,
    BackupConfig,
    RollbackStrategy,
    DownMethodPolicy,
    MigrationScriptExecutor
} from '@migration-script-runner/core';
import { MyDatabaseHandler } from './database-handler';

// Create configuration
const config = new Config();

// Migration settings
config.folder = './database/migrations';
config.filePattern = /^V(\d+)_(.+)\.ts$/;
config.tableName = 'migration_history';
config.displayLimit = 20;
config.beforeMigrateName = 'beforeMigrate';
config.recursive = true;

// Validation settings
config.validateBeforeRun = true;
config.strictValidation = process.env.CI === 'true';
config.downMethodPolicy = DownMethodPolicy.AUTO;

// Rollback strategy
config.rollbackStrategy = RollbackStrategy.BOTH;

// Backup settings (for BACKUP/BOTH strategies)
config.backup = new BackupConfig();
config.backup.folder = './database/backups';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
config.backup.timestampFormat = 'YYYYMMDD-HHmmss';
config.backup.prefix = 'db-backup';

// Custom validators (optional)
if (process.env.NODE_ENV === 'production') {
    config.customValidators = [
        new NamingValidator(),
        new DocumentationValidator()
    ];
}

// Initialize executor
const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler, config);

// Run migrations
await executor.migrate();
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

// Strict validation in CI
config.strictValidation = process.env.CI === 'true';

// Different rollback strategies
config.rollbackStrategy = process.env.NODE_ENV === 'production'
    ? RollbackStrategy.BOTH
    : RollbackStrategy.DOWN;

// Environment-specific backup naming
config.backup.filename = process.env.NODE_ENV || 'dev';

// Different backup retention
config.backup.deleteBackup = process.env.NODE_ENV === 'production';
```

---

## Default Values

If you don't configure these settings, MSR uses these defaults:

| Setting | Default Value |
|---------|--------------|
| `folder` | `./migrations` |
| `filePattern` | `/^V(\d{12})_/` |
| `tableName` | `'schema_version'` |
| `displayLimit` | `0` (show all) |
| `beforeMigrateName` | `'beforeMigrate'` |
| `recursive` | `true` |
| `rollbackStrategy` | `RollbackStrategy.BACKUP` |
| `validateBeforeRun` | `true` |
| `strictValidation` | `false` |
| `downMethodPolicy` | `DownMethodPolicy.AUTO` |
| `customValidators` | `[]` |

See individual configuration pages for backup defaults.

---

## Configuration Patterns

### Development Configuration

Fast iteration with minimal overhead:

```typescript
const config = new Config();
config.folder = './migrations';
config.rollbackStrategy = RollbackStrategy.DOWN;  // Fast rollback
config.validateBeforeRun = true;
config.strictValidation = false;  // Allow warnings
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
```

### CI/CD Configuration

Strict validation and quality checks:

```typescript
const config = new Config();
config.folder = './migrations';
config.rollbackStrategy = RollbackStrategy.BOTH;
config.validateBeforeRun = true;
config.strictValidation = true;  // Block on warnings
config.downMethodPolicy = DownMethodPolicy.REQUIRED;
config.customValidators = [
    new NamingValidator(),
    new DocumentationValidator(),
    new SqlSafetyValidator()
];
```

### Production Configuration

Safety-first with backups:

```typescript
const config = new Config();
config.folder = './migrations';
config.rollbackStrategy = RollbackStrategy.BOTH;
config.validateBeforeRun = true;
config.strictValidation = false;  // Allow warnings (but log them)
config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

// Reliable backup configuration
config.backup = new BackupConfig();
config.backup.folder = '/var/backups/database';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
```

---

## Configuration Topics

Explore detailed configuration options:

- **[Migration Settings](migration-settings)** - File discovery, patterns, and tracking
- **[Validation Settings](validation-settings)** - Validation rules and policies
- **[Rollback Settings](rollback-settings)** - Rollback strategies explained
- **[Backup Settings](backup-settings)** - Backup file configuration

---

## Next Steps

- [Migration Settings](migration-settings) - Configure file discovery
- [Validation Settings](validation-settings) - Configure validation
- [Writing Migrations](../guides/writing-migrations) - Best practices
- [Getting Started](../getting-started) - Quick start guide

---

## Related Documentation

- [Validation](../validation/) - Validation system overview
- [Rollback Strategies](rollback-settings) - Choosing the right strategy
- [Architecture](../development/architecture/) - System design
- [API Reference](../api/) - Complete API documentation
