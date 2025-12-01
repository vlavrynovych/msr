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
- **[ISqlDB](sql-db)** - Extended interface for SQL databases (v0.4.0+)

### Schema Tracking

- **[ISchemaVersion](schema-version)** - Schema version table management
- **[IMigrationScript](schema-version#imigrationscript)** - Migration record access
- **[IMigrationInfo](migration-info)** - Migration execution metadata

### Migration Execution

- **[IRunnableScript](runnable-script)** - Migration script implementation
- **[IMigrationResult](migration-result)** - Migration operation results

### Rollback & Backup

- **[IRollbackService](rollback-service)** - Rollback strategy implementation
- **[IBackup](backup)** - Backup and restore operations

### File Loading (v0.4.0+)

- **[IMigrationScriptLoader](loaders)** - Custom file type loader
- **[ILoaderRegistry](loaders#iloaderregistry)** - Loader management

### Services

- **[IMigrationService](migration-service)** - Migration file discovery

---

## Interface Hierarchy

```
IDatabaseMigrationHandler (your implementation)
├── db: IDB (or ISqlDB for SQL databases)
├── schemaVersion: ISchemaVersion
│   └── migrationRecords: IMigrationScript
└── backup?: IBackup (optional)

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
class MyHandler implements IDatabaseMigrationHandler {
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

class MyHandler implements IDatabaseMigrationHandler {
  db: MyDB;
  schemaVersion: MySchemaVersion;
  backup: MyBackup;  // Now included

  getName(): string {
    return 'MyDatabase Handler';
  }
}
```

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

## Related Documentation

- [Core Classes](../core-classes) - MigrationScriptExecutor and other classes
- [Services](../services) - Service implementations
- [Getting Started](../../getting-started) - Basic setup guide
- [Recipes](../../guides/recipes/) - Complete implementation examples
