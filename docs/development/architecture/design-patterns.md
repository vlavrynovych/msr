---
layout: default
title: Design Patterns
parent: Architecture
nav_order: 4
---

# Design Patterns
{: .no_toc }

Architectural patterns and design decisions in MSR.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Class Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   MigrationScriptExecutor                        │
├─────────────────────────────────────────────────────────────────┤
│ - handler: IDatabaseMigrationHandler                            │
│ - backupService: IBackupService                                 │
│ - schemaVersionService: ISchemaVersionService                   │
│ - migrationService: IMigrationService                           │
│ - migrationRenderer: IMigrationRenderer                         │
│ - migrationScanner: IMigrationScanner                           │
│ - selector: MigrationScriptSelector                             │
│ - runner: MigrationRunner                                       │
│ - logger: ILogger                                               │
├─────────────────────────────────────────────────────────────────┤
│ + migrate(): Promise<IMigrationResult>                          │
│ + list(number?: number): Promise<void>                          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ delegates to
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ MigrationScanner │  │ MigrationScrip│  │  MigrationRunner     │
├──────────────────┤  │ tSelector     │  ├──────────────────────┤
│ - migrationService│ ├──────────────┤  │ - handler            │
│ - schemaVersion   │  │ (stateless)  │  │ - schemaVersionService│
│   Service         │  ├──────────────┤  │ - logger             │
│ - selector        │  │ + getPending()│  ├──────────────────────┤
│ - handler         │  │ + getIgnored()│  │ + execute()          │
├──────────────────┤  └──────────────┘  │ + executeOne()       │
│ + scan()         │                     └──────────────────────┘
└──────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     Supporting Services                       │
├──────────────────────────┬──────────────────┬────────────────┤
│   BackupService          │ SchemaVersion    │ MigrationService│
│   • backup()             │ Service          │ • readMigration │
│   • restore()            │ • init()         │   Scripts()     │
│   • deleteBackup()       │ • save()         │ • parseFilename()│
│                          │ • getAllMigrated │                 │
└──────────────────────────┴──────────────────┴─────────────────┘
```

---

## Dependency Injection

MSR supports optional dependency injection for all services, enabling:
- **Testing** - Mock services for unit tests
- **Customization** - Replace default implementations
- **Extension** - Add new functionality

### Default vs Custom Dependencies

```typescript
// Default (uses built-in dependencies)
const config = new Config();
const executor = new MigrationScriptExecutor(handler, config);
// Uses: ConsoleLogger, BackupService, SchemaVersionService, etc.

// Custom dependencies
const executor2 = new MigrationScriptExecutor(handler, config, {
    logger: new SilentLogger(),          // Custom logger
    backupService: new S3BackupService(), // Custom backup
    renderStrategy: new JsonRenderStrategy()  // Custom render strategy
});
```

### Dependency Graph

```
MigrationScriptExecutor
  │
  ├─▶ ILogger (injected or default: ConsoleLogger)
  │
  ├─▶ IBackupService (injected or default: BackupService)
  │     └─▶ ILogger
  │
  ├─▶ ISchemaVersionService (injected or default: SchemaVersionService)
  │     └─▶ ISchemaVersionDAO (from handler)
  │
  ├─▶ IMigrationService (injected or default: MigrationService)
  │     └─▶ ILogger
  │
  ├─▶ IMigrationRenderer (injected or default: MigrationRenderer)
  │     └─▶ IRenderStrategy (injected or default: AsciiTableRenderStrategy)
  │           └─▶ ILogger
  │
  ├─▶ IMigrationScanner (injected or default: MigrationScanner)
  │     ├─▶ IMigrationService
  │     ├─▶ ISchemaVersionService
  │     ├─▶ MigrationScriptSelector
  │     └─▶ IDatabaseMigrationHandler
  │
  ├─▶ MigrationScriptSelector (always created)
  │     └─▶ (stateless, no dependencies)
  │
  └─▶ MigrationRunner (always created)
        ├─▶ IDatabaseMigrationHandler
        ├─▶ ISchemaVersionService
        └─▶ ILogger
```

---

## Layer Responsibilities

### Layer 1: Orchestration
**Class:** `MigrationScriptExecutor`
**Role:** Coordinates workflow, handles errors, manages lifecycle

### Layer 2: Business Logic
**Classes:** `MigrationScriptSelector`, `MigrationRunner`
**Role:** Core migration logic - filtering and execution

### Layer 3: Services
**Classes:** `BackupService`, `SchemaVersionService`, `MigrationService`, `MigrationRenderer`
**Role:** Specialized operations - backup, tracking, discovery, display

### Layer 4: Models
**Classes:** `MigrationScript`, `Config`, `BackupConfig`
**Role:** Data structures and configuration

### Layer 5: Interfaces
**Interfaces:** `IDB`, `IDatabaseMigrationHandler`, `ILogger`, etc.
**Role:** Contracts and abstraction boundaries

### Layer 6: Database Handlers
**User-provided:** PostgreSQL, MySQL, MongoDB handlers
**Role:** Database-specific implementations

---

## Extension Points

### Custom Logger

```typescript
import { ILogger } from '@migration-script-runner/core';

class CloudLogger implements ILogger {
    log(message: string) {
        sendToCloudWatch(message);
    }
    // ... implement other methods
}

const executor = new MigrationScriptExecutor(handler, config, {
    logger: new CloudLogger()
});
```

### Custom Backup

```typescript
import { IBackupService } from '@migration-script-runner/core';

class S3BackupService implements IBackupService {
    async backup() {
        const dump = await createDump();
        await s3.upload(dump);
    }
    // ... implement restore, deleteBackup
}

const executor = new MigrationScriptExecutor(handler, config, {
    backupService: new S3BackupService()
});
```

### Custom Render Strategy

```typescript
import { IRenderStrategy, JsonRenderStrategy } from '@migration-script-runner/core';

// Use built-in JSON render strategy
const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new JsonRenderStrategy(true)  // pretty-printed JSON
});

// Or create a custom render strategy
class CustomRenderStrategy implements IRenderStrategy {
    renderMigrated(scripts, handler, limit) {
        console.log('Custom output:', scripts);
    }
    // ... implement other methods
}

const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new CustomRenderStrategy()
});
```

---

