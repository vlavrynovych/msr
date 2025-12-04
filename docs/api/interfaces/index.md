---
layout: default
title: Interfaces
parent: API Reference
nav_order: 2
has_children: true
---

# Interfaces
{: .no_toc }

Core interfaces for implementing database handlers and extending MSR.
{: .fs-6 .fw-300 }

---

## Overview

MSR provides a set of well-defined interfaces that you implement to integrate with your database and customize behavior. These interfaces follow the **dependency inversion principle**, allowing you to bring your own database client, backup solution, and custom logic.

---

## Core Interfaces

### Database Integration

- **[IDatabaseMigrationHandler](database-handler)** - Main interface you implement for your database
- **[IDB](db)** - Base database connection interface (all databases)
- **ISqlDB** - Extended interface for SQL databases (v0.4.0+)
- **[ITransactionalDB](transactional-db)** - Transaction support interface

### Schema Tracking

- **[ISchemaVersion](schema-version)** - Schema version table management
- **IMigrationScript** - Migration record access
- **IMigrationInfo** - Migration execution metadata

### Migration Execution

- **[IRunnableScript](runnable-script)** - Migration script implementation
- **IMigrationResult** - Migration operation results

### Transaction Management

- **[ITransactionManager](transaction-manager)** - Transaction lifecycle management

### Rollback & Backup

- **IRollbackService** - Rollback strategy implementation
- **IBackup** - Backup and restore operations

### File Loading (v0.4.0+)

- **IMigrationScriptLoader** - Custom file type loader
- **ILoaderRegistry** - Loader management

### Observability (v0.6.0+)

- **[IMetricsCollector](metrics-collector)** - Metrics collection for monitoring and performance tracking

### Services

- **IMigrationService** - Migration file discovery

---

## Interface Hierarchy

```
IDatabaseMigrationHandler (your implementation)
├── db: IDB (or ISqlDB for SQL databases)
├── schemaVersion: ISchemaVersion
│   └── migrationRecords: IMigrationScript
└── backup?: IBackup<IDB> (optional)

IRunnableScript (your migrations)
├── up(db, info, handler)
└── down?(db, info, handler)

IMigrationScriptLoader (extensibility)
└── Managed by ILoaderRegistry
```

---

## Quick Start

### Minimal Implementation

The minimum you need to implement:

```typescript
import {
  IDatabaseMigrationHandler,
  IDB,
  ISchemaVersion,
  IMigrationScript,
  IMigrationInfo
} from '@migration-script-runner/core';

// 1. Database connection
class MyDB implements IDB {
  async checkConnection(): Promise<void> {
    // Validate connection
  }
}

// 2. Migration records
class MyMigrationScript implements IMigrationScript {
  async getAllExecuted(): Promise<IMigrationInfo[]> {
    // Return executed migrations
  }
  async save(info: IMigrationInfo): Promise<void> {
    // Save migration record
  }
  async remove(timestamp: number): Promise<void> {
    // Remove migration record
  }
}

// 3. Schema version
class MySchemaVersion implements ISchemaVersion {
  migrationRecords: IMigrationScript;
  async isInitialized(): Promise<boolean> { /* ... */ }
  async createTable(): Promise<void> { /* ... */ }
  async validateTable(): Promise<void> { /* ... */ }
}

// 4. Database handler
class MyHandler implements IDatabaseMigrationHandler<IDB> {
  db: MyDB;
  schemaVersion: MySchemaVersion;

  getName(): string {
    return 'MyDatabase Handler';
  }
}
```

### With SQL Support (v0.4.0+)

For SQL migration files, implement `ISqlDB`:

```typescript
import { ISqlDB } from '@migration-script-runner/core';

class MyDB implements ISqlDB {
  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async query(sql: string): Promise<unknown> {
    return await this.pool.query(sql);
  }
}
```

### With Backup Support

For BACKUP rollback strategy, implement `IBackup`:

```typescript
import { IBackup } from '@migration-script-runner/core';

class MyBackup implements IBackup {
  async backup(): Promise<string> {
    // Create backup, return identifier
  }

  async restore(backupData: string): Promise<void> {
    // Restore from backup
  }
}

class MyHandler implements IDatabaseMigrationHandler<IDB> {
  db: MyDB;
  schemaVersion: MySchemaVersion;
  backup: MyBackup;  // Now included

  getName(): string {
    return 'MyDatabase Handler';
  }
}
```

---

## Changes in v0.6.0

{: .important }
> Version 0.6.0 adds generic type parameters and new metrics interfaces. See the [v0.5.x → v0.6.0 Migration Guide](../../version-migration/v0.5-to-v0.6) for upgrade instructions.

**Summary of Changes:**

### Generic Type Parameters (BREAKING CHANGE) - [#114](https://github.com/migration-script-runner/msr-core/issues/114)
All interfaces now require generic type parameters for database-specific type safety:

- `IDatabaseMigrationHandler` → `IDatabaseMigrationHandler<DB extends IDB>`
- `IRunnableScript` → `IRunnableScript<DB extends IDB>`
- `ISchemaVersion` → `ISchemaVersion<DB extends IDB>`
- `IBackup` → `IBackup<DB extends IDB>`
- `ITransactionManager` → `ITransactionManager<DB extends IDB>`

**Benefits:** Full IDE autocomplete, compile-time validation, no more `as any` casting

**Breaking Change:** You must explicitly specify the type parameter (e.g., `IDatabaseMigrationHandler<IDB>`) in your implementations

### New Interfaces - [#80](https://github.com/migration-script-runner/msr-core/issues/80)
- `IMetricsCollector` - Metrics collection for observability and performance tracking

### Constructor Signature Change (Breaking)
- `MigrationScriptExecutor` constructor now requires dependency injection pattern: `new MigrationScriptExecutor({ handler }, config?)`

---

## Breaking Changes (v0.4.0)

{: .important }
> Version 0.4.0 includes several interface changes. See the [v0.3.x → v0.4.0 Migration Guide](../../version-migration/v0.3-to-v0.4) for upgrade instructions.

**Summary:**
- `IDB.checkConnection()` now required
- `ISqlDB` interface added for SQL migrations
- `ISchemaVersion.migrations` → `migrationRecords`
- `IMigrationScript.getAll()` → `getAllExecuted()`
- `IBackup.restore(data)` → `restore(backupData)`
- `IMigrationService` method renames
- New loader interfaces: `IMigrationScriptLoader`, `ILoaderRegistry`

---

