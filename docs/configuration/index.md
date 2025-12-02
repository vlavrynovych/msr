---
layout: default
title: Configuration
parent: API Reference
nav_order: 2
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

- **🎯 [Migration Settings](migration-settings)** - File paths, patterns, and script discovery
- **✅ [Validation Settings](validation-settings)** - Validation rules and policies
- **🔄 [Rollback Settings](rollback-settings)** - Rollback strategies and behavior
- **💾 [Backup Settings](backup-settings)** - Backup configuration for BACKUP strategy
- **🔒 [Transaction Settings](transaction-settings)** - Transaction management and retry configuration

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

await executor.up();
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
| 🎯 [Migration Settings](migration-settings) | `folder`, `filePattern`, `tableName`, `displayLimit`, `beforeMigrateName`, `recursive` | Control how migrations are discovered and tracked |
| 🎚️ Logging Settings | `logLevel`, `showBanner` | Configure output verbosity and display options |
| ✅ [Validation Settings](validation-settings) | `validateBeforeRun`, `strictValidation`, `downMethodPolicy`, `customValidators` | Control validation behavior and rules |
| 🔄 [Rollback Settings](rollback-settings) | `rollbackStrategy` | Choose backup, down(), both, or none |
| 💾 [Backup Settings](backup-settings) | `backup` (BackupConfig) | Configure backup file naming and storage |
| 🔒 [Transaction Settings](transaction-settings) | `transaction` (TransactionConfig) | Configure transaction mode, isolation level, and retry behavior |

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
config.filePatterns = [/^V(\d+)_(.+)\.ts$/];

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

### 4. Configure Transactions

Control how migrations are wrapped in database transactions:

```typescript
import { TransactionMode, IsolationLevel } from '@migration-script-runner/core';

// Standard approach: Each migration in its own transaction
config.transaction.mode = TransactionMode.PER_MIGRATION;
config.transaction.isolation = IsolationLevel.READ_COMMITTED;
config.transaction.retries = 3;

// Batch mode: All migrations in one transaction
config.transaction.mode = TransactionMode.PER_BATCH;

// No automatic transactions (for NoSQL or custom logic)
config.transaction.mode = TransactionMode.NONE;
```

See [Transaction Settings](transaction-settings) for all transaction options.

### 5. Configure Backup (if using BACKUP strategy)

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
    TransactionMode,
    IsolationLevel,
    MigrationScriptExecutor
} from '@migration-script-runner/core';
import { MyDatabaseHandler } from './database-handler';

// Create configuration
const config = new Config();

// Migration settings
config.folder = './database/migrations';
config.filePatterns = [/^V(\d+)_(.+)\.ts$/];
config.tableName = 'migration_history';
config.displayLimit = 20;
config.beforeMigrateName = 'beforeMigrate';
config.recursive = true;

// Validation settings
config.validateBeforeRun = true;
config.strictValidation = process.env.CI === 'true';
config.downMethodPolicy = DownMethodPolicy.AUTO;

// Transaction settings
config.transaction.mode = TransactionMode.PER_MIGRATION;
config.transaction.isolation = IsolationLevel.READ_COMMITTED;
config.transaction.retries = 3;
config.transaction.retryDelay = 100;
config.transaction.retryBackoff = true;

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

## Waterfall Configuration Loading

MSR supports automatic configuration loading using a waterfall approach with **environment variables** and **config files**. This follows [12-Factor App](https://12factor.net/config) principles for production-ready applications.

### Loading Priority

Configuration is loaded in this order (highest priority last):

1. **Built-in defaults** - From `Config` class defaults
2. **Config file** - Auto-detected or from `MSR_CONFIG_FILE`
   Supported formats: `.js`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`
3. **Environment variables** - `MSR_*` environment variables
4. **Constructor overrides** - Passed directly to MigrationScriptExecutor

### Automatic Loading

With v0.5.0+, configuration is loaded automatically if not provided:

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';
import { MyDatabaseHandler } from './database-handler';

// Automatically loads config from env vars, files, or defaults
const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler);

await executor.up();
```

### Manual Loading with ConfigLoader

For more control, use `ConfigLoader.load()`:

```typescript
import { ConfigLoader, MigrationScriptExecutor } from '@migration-script-runner/core';

// Load with waterfall approach (auto-detect config file)
const config = ConfigLoader.load();

// Load with overrides (highest priority)
const config = ConfigLoader.load({
    folder: './migrations',
    dryRun: true
});

// Load from specific directory
const config = ConfigLoader.load({}, { baseDir: '/app' });

// Use specific config file (any format)
const config = ConfigLoader.load({}, {
    configFile: './config/production.yaml'
});

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler, config);
```

---

## Environment Variables

Configure MSR using `MSR_*` environment variables - the **recommended approach** for production deployments following [12-Factor App](https://12factor.net/config) principles.

**Quick Example:**
```bash
export MSR_FOLDER=./database/migrations
export MSR_TABLE_NAME=migration_history
export MSR_LOGGING_ENABLED=true
export MSR_BACKUP_FOLDER=./backups
```

**Complete Documentation:**
- 📖 **[Environment Variables User Guide](../guides/environment-variables)** - How-to guide with practical examples, platform-specific configs (Docker, Kubernetes, etc.), and troubleshooting
- 📋 **[Environment Variables API Reference](../api/environment-variables/)** - Complete reference with detailed descriptions for all MSR_* variables (Core, Validation, Logging, Backup, Transaction)
- 🔧 **[ConfigLoader API](../api/ConfigLoader)** - API reference for programmatic configuration loading
- 🏷️ **[EnvironmentVariables Type](../../src/model/env/index.ts)** - Type-safe environment variable names

---

## Configuration Files

MSR supports multiple configuration file formats to fit your project's ecosystem. Config files are loaded automatically from your project root using the waterfall approach.

### Supported Formats

MSR supports the following configuration file formats (searched in this priority order):

| Format | Files | Status | Optional Dependency |
|--------|-------|--------|---------------------|
| **JavaScript** | `msr.config.js` | ✅ Always available | None |
| **JSON** | `msr.config.json` | ✅ Always available | None |
| **YAML** | `msr.config.yaml`, `msr.config.yml` | 📦 Optional | `js-yaml` |
| **TOML** | `msr.config.toml` | 📦 Optional | `@iarna/toml` |
| **XML** | `msr.config.xml` | 📦 Optional | `fast-xml-parser` |

**Core is lightweight:** Format parsers for YAML, TOML, and XML are optional peer dependencies. Install only the ones you need.

### JavaScript Configuration

```javascript
// msr.config.js
module.exports = {
    folder: './database/migrations',
    tableName: 'migration_history',
    validateBeforeRun: true,
    transaction: {
        mode: 'PER_MIGRATION',
        retries: 3
    },
    backup: {
        folder: './backups',
        timestamp: true
    }
};
```

### JSON Configuration

```json
{
    "folder": "./database/migrations",
    "tableName": "migration_history",
    "validateBeforeRun": true,
    "transaction": {
        "mode": "PER_MIGRATION",
        "retries": 3
    },
    "backup": {
        "folder": "./backups",
        "timestamp": true
    }
}
```

### YAML Configuration

**Installation:**
```bash
npm install js-yaml
```

**Configuration:**
```yaml
# msr.config.yaml
folder: ./database/migrations
tableName: migration_history
validateBeforeRun: true

transaction:
  mode: PER_MIGRATION
  retries: 3

backup:
  folder: ./backups
  timestamp: true
```

### TOML Configuration

**Installation:**
```bash
npm install @iarna/toml
```

**Configuration:**
```toml
# msr.config.toml
folder = "./database/migrations"
tableName = "migration_history"
validateBeforeRun = true

[transaction]
mode = "PER_MIGRATION"
retries = 3

[backup]
folder = "./backups"
timestamp = true
```

### XML Configuration

**Installation:**
```bash
npm install fast-xml-parser
```

**Configuration:**
```xml
<!-- msr.config.xml -->
<msr>
  <folder>./database/migrations</folder>
  <tableName>migration_history</tableName>
  <validateBeforeRun>true</validateBeforeRun>

  <transaction>
    <mode>PER_MIGRATION</mode>
    <retries>3</retries>
  </transaction>

  <backup>
    <folder>./backups</folder>
    <timestamp>true</timestamp>
  </backup>
</msr>
```

### Specifying Config File

You can specify a config file explicitly using `ConfigLoaderOptions`:

```typescript
import { ConfigLoader } from '@migration-script-runner/core';

// Use specific config file
const config = ConfigLoader.load({}, {
    configFile: './config/production.yaml'
});

// Search in different directory
const config = ConfigLoader.load({}, {
    baseDir: './config'
});

// Backward compatible: baseDir as string
const config = ConfigLoader.load({}, './config');
```

**Complete Documentation:**
- See [Environment Variables User Guide](../guides/environment-variables#configuration-files) for detailed config file examples
- See [ConfigLoader API](../api/ConfigLoader#loadfromfile) for programmatic file loading

---

## Environment-Specific Configuration (Legacy)

**Note:** Using `ConfigLoader` and environment variables (above) is the recommended approach for v0.5.0+.

For manual configuration in code:

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
config.backup.custom = process.env.NODE_ENV || 'dev';

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

- **🎯 [Migration Settings](migration-settings)** - File discovery, patterns, and tracking
- **✅ [Validation Settings](validation-settings)** - Validation rules and policies
- **🔄 [Rollback Settings](rollback-settings)** - Rollback strategies explained
- **💾 [Backup Settings](backup-settings)** - Backup file configuration
- **🔒 [Transaction Settings](transaction-settings)** - Transaction modes, isolation levels, and retry behavior

---

## Next Steps

- [Migration Settings](migration-settings) - Configure file discovery
- [Validation Settings](validation-settings) - Configure validation
- [Transaction Settings](transaction-settings) - Configure transactions
- [Writing Migrations](../guides/writing-migrations) - Best practices
- [Getting Started](../getting-started) - Quick start guide

---

