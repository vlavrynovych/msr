---
layout: default
title: Architecture
nav_order: 8
---

# Architecture
{: .no_toc }

Comprehensive guide to MSR's internal architecture, component design, and how the pieces fit together.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR (Migration Script Runner) follows a layered architecture with clear separation of concerns. The system is designed around the Single Responsibility Principle, with each class handling one specific aspect of the migration workflow.

### Design Principles

- **Single Responsibility** - Each class has one clear purpose
- **Dependency Injection** - Services receive dependencies through constructors
- **Interface Segregation** - Small, focused interfaces rather than large ones
- **Open/Closed** - Open for extension, closed for modification
- **Fail-Fast** - Stop execution immediately on first error

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Application                         │
│                  (Your migration script code)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MigrationScriptExecutor                        │
│                    (Orchestration Layer)                         │
│  • Coordinates entire migration workflow                         │
│  • Manages service lifecycle                                     │
│  • Handles errors and recovery                                   │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────────┐
│Backup  │ │Schema  │ │Migration│ │Migration │ │Migration         │
│Service │ │Version │ │Service  │ │Renderer  │ │ScriptSelector    │
│        │ │Service │ │         │ │          │ │                  │
└────────┘ └────────┘ └────────┘ └──────────┘ └──────────────────┘
     │          │          │          │          │
     │          │          │          │          ▼
     │          │          │          │      ┌──────────────────┐
     │          │          │          │      │MigrationRunner   │
     │          │          │          │      │                  │
     │          │          │          │      └──────────────────┘
     │          │          │          │
     ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  IDatabaseMigrationHandler                       │
│                   (Database Abstraction)                         │
│  • PostgreSQL, MySQL, MongoDB, etc.                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### MigrationScriptExecutor

**Purpose:** Orchestrates the entire migration workflow

**Responsibilities:**
- Initializes all required services
- Coordinates backup → migrate → restore workflow
- Handles errors and recovery
- Displays progress and results

**Key Dependencies:**
- `IBackupService` - Database backup/restore
- `ISchemaVersionService` - Track executed migrations
- `IMigrationService` - Discover migration files
- `IMigrationRenderer` - Display output
- `MigrationScriptSelector` - Filter migrations
- `MigrationRunner` - Execute migrations

**Location:** `src/service/MigrationScriptExecutor.ts`

```typescript
// Example usage
const executor = new MigrationScriptExecutor(handler, {
    logger: new SilentLogger(),  // Optional DI
    backupService: customBackup  // Optional DI
});

const result = await executor.migrate();
```

---

### MigrationScriptSelector

**Purpose:** Determines which migrations should be executed

**Responsibilities:**
- Compare discovered scripts with executed migrations
- Filter out already-executed migrations
- Identify out-of-order migrations (ignored)
- Return only pending migrations (todo)

**Key Methods:**
- `getTodo(migrated, all)` - Returns scripts to execute
- `getIgnored(migrated, all)` - Returns outdated scripts

**Algorithm:**
```
1. Find max timestamp of executed migrations
2. Get scripts not in executed list
3. Filter: only scripts newer than max timestamp
4. Result: pending migrations to execute
```

**Location:** `src/service/MigrationScriptSelector.ts`

**Example:**
```typescript
const selector = new MigrationScriptSelector();

// migrated = [V1, V2, V5]
// all = [V1, V2, V3, V5, V6]
const todo = selector.getTodo(migrated, all);
// → [V6]  (V3 ignored because < V5)

const ignored = selector.getIgnored(migrated, all);
// → [V3]  (older than last executed V5)
```

---

### MigrationRunner

**Purpose:** Executes migration scripts with metadata tracking

**Responsibilities:**
- Execute scripts sequentially in chronological order
- Record execution timing (startedAt, finishedAt)
- Capture current username
- Save metadata to schema version table
- Stop on first error (fail-fast)

**Key Methods:**
- `execute(scripts)` - Execute multiple scripts in order
- `executeOne(script)` - Execute single script with metadata

**Execution Flow:**
```
For each script (in timestamp order):
  1. Set username (from OS)
  2. Record startedAt timestamp
  3. Call script.up(db, info, handler)
  4. Record finishedAt timestamp
  5. Save to schema_version table
  6. Continue to next (or stop on error)
```

**Location:** `src/service/MigrationRunner.ts`

**Example:**
```typescript
const runner = new MigrationRunner(handler, schemaVersionService, logger);

const scripts = [script1, script2, script3];
const executed = await runner.execute(scripts);
// → Scripts executed in order, metadata recorded
```

---

### BackupService

**Purpose:** Create and manage database backups

**Responsibilities:**
- Create backup before migrations
- Restore backup on failure
- Delete backup after success
- Handle backup lifecycle

**Location:** `src/service/BackupService.ts`

**Workflow:**
```
migrate() {
  backup()           // ← BackupService
  try {
    run migrations
    deleteBackup()   // ← Success: remove backup
  } catch (err) {
    restore()        // ← Failure: restore from backup
    deleteBackup()   // ← Cleanup
  }
}
```

---

### SchemaVersionService

**Purpose:** Track migration history in database

**Responsibilities:**
- Initialize schema_version table
- Save executed migration metadata
- Retrieve migration history
- Validate table structure

**Table Structure:**
```sql
CREATE TABLE schema_version (
  timestamp BIGINT PRIMARY KEY,
  name VARCHAR(255),
  username VARCHAR(255),
  started_at BIGINT,
  finished_at BIGINT,
  result TEXT
);
```

**Location:** `src/service/SchemaVersionService.ts`

---

### MigrationService

**Purpose:** Discover and load migration script files

**Responsibilities:**
- Scan migrations folder for files
- Parse filenames (extract timestamps)
- Load migration modules
- Validate migration structure

**Filename Format:**
```
V{timestamp}_{description}.{ts|js}
Example: V202311020036_create_users_table.ts
```

**Location:** `src/service/MigrationService.ts`

---

### MigrationRenderer

**Purpose:** Render migration information using pluggable strategies

**Responsibilities:**
- Delegate rendering to configured strategy (ASCII tables, JSON, silent)
- Display figlet banner via strategy
- Coordinate output formatting across different formats
- Show execution status in various output formats

**Location:** `src/service/MigrationRenderer.ts`

**Supported Strategies:**
- `AsciiTableRenderStrategy` - ASCII tables with formatted timestamps and durations
- `JsonRenderStrategy` - Structured JSON output (pretty or compact)
- `SilentRenderStrategy` - No output (for testing and library usage)
- Custom strategies via `IRenderStrategy` interface

---

## Data Flow

### Complete Migration Workflow

```
1. User calls executor.migrate()
   │
   ├─▶ 2. BackupService.backup()
   │      └─▶ Creates database dump
   │
   ├─▶ 3. SchemaVersionService.init()
   │      └─▶ Creates/validates schema_version table
   │
   ├─▶ 4. MigrationService.readMigrationScripts()
   │      └─▶ Discovers all .ts/.js files in migrations/
   │
   ├─▶ 5. SchemaVersionService.getAllMigratedScripts()
   │      └─▶ Queries schema_version table
   │
   ├─▶ 6. MigrationScriptSelector.getTodo()
   │      └─▶ Filters: new scripts > last executed
   │
   ├─▶ 7. MigrationRunner.execute()
   │      └─▶ For each script:
   │          ├─▶ script.init() (load module)
   │          ├─▶ script.up(db, info, handler)
   │          └─▶ SchemaVersionService.save()
   │
   ├─▶ 8. BackupService.deleteBackup()
   │      └─▶ Success: remove backup
   │
   └─▶ 9. Return IMigrationResult
          └─▶ { success, executed, migrated, ignored }

If error at any step:
   ├─▶ BackupService.restore()
   ├─▶ BackupService.deleteBackup()
   └─▶ Return IMigrationResult with errors
```

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
│ - selector: MigrationScriptSelector                             │
│ - runner: MigrationRunner                                       │
│ - logger: ILogger                                               │
├─────────────────────────────────────────────────────────────────┤
│ + migrate(): Promise<IMigrationResult>                          │
│ + list(number?: number): Promise<void>                          │
│ + getTodo(migrated, all): MigrationScript[]                     │
│ + getIgnored(migrated, all): MigrationScript[]                  │
│ + execute(scripts): Promise<MigrationScript[]>                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ delegates to
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
        ▼                                         ▼
┌──────────────────────────┐         ┌──────────────────────────┐
│ MigrationScriptSelector  │         │    MigrationRunner       │
├──────────────────────────┤         ├──────────────────────────┤
│ (no state)               │         │ - handler                │
├──────────────────────────┤         │ - schemaVersionService   │
│ + getTodo()              │         │ - logger                 │
│ + getIgnored()           │         ├──────────────────────────┤
└──────────────────────────┘         │ + execute()              │
                                     │ + executeOne()           │
                                     └──────────────────────────┘

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
// Default (backward compatible)
const executor = new MigrationScriptExecutor(handler);
// Uses: ConsoleLogger, BackupService, SchemaVersionService, etc.

// Custom dependencies
const executor = new MigrationScriptExecutor(handler, {
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

## Migration Script Lifecycle

### States

```
┌─────────────┐
│ Discovered  │  ← MigrationService finds file
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Filtered   │  ← MigrationScriptSelector: todo/ignored/migrated
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Initialized │  ← script.init() loads module
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Executing  │  ← MigrationRunner: set username, startedAt
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Completed  │  ← Set finishedAt, result, save to DB
└─────────────┘
```

### Script Object Evolution

```typescript
// 1. Discovery (MigrationService)
{
  name: "V202311020036_create_users.ts",
  filepath: "/path/to/migrations/V202311020036_create_users.ts",
  timestamp: 202311020036,
  script: undefined  // Not loaded yet
}

// 2. Initialization (script.init())
{
  name: "V202311020036_create_users.ts",
  filepath: "/path/to/migrations/V202311020036_create_users.ts",
  timestamp: 202311020036,
  script: {
    up: async (db, info, handler) => { ... }
  }
}

// 3. Execution (MigrationRunner)
{
  name: "V202311020036_create_users.ts",
  filepath: "/path/to/migrations/V202311020036_create_users.ts",
  timestamp: 202311020036,
  username: "developer",        // ← Added
  startedAt: 1699999999000,     // ← Added
  finishedAt: 1699999999500,    // ← Added
  result: "Created 3 tables",   // ← Added (from up() return)
  script: { up: ... }
}
```

---

## Error Handling Strategy

### Fail-Fast Philosophy

MSR stops execution immediately on the first error to prevent cascading failures and maintain database consistency.

```
Script 1: ✓ Success
Script 2: ✓ Success
Script 3: ✗ FAILS
Script 4: ⊗ Not executed (stopped)
Script 5: ⊗ Not executed (stopped)

Action: Restore from backup, rollback all changes
```

### Error Flow

```
try {
  await backup.create()
  await schema.init()
  await runner.execute(scripts)  // ← Error here
  backup.delete()
  return { success: true }
} catch (error) {
  await backup.restore()  // ← Rollback
  backup.delete()         // ← Cleanup
  return {
    success: false,
    errors: [error]
  }
}
```

### Recovery Process

1. **Error Occurs** - Migration script throws exception
2. **Stop Execution** - Remaining scripts not executed
3. **Restore Backup** - Database rolled back to pre-migration state
4. **Delete Backup** - Cleanup temporary backup file
5. **Return Result** - Report failure with error details

---

## Testing Strategy

### Test Levels

#### Unit Tests
**Location:** `test/unit/`
**Purpose:** Test individual classes in isolation
**Coverage:** 100% branches, statements, functions

```
test/unit/service/
  ├── MigrationScriptSelector.test.ts  (11 tests)
  ├── MigrationRunner.test.ts          (16 tests)
  ├── BackupService.test.ts
  ├── SchemaVersionService.test.ts
  └── ...
```

#### Integration Tests
**Location:** `test/integration/`
**Purpose:** Test multiple components working together
**Coverage:** Real workflow scenarios

```
test/integration/service/
  └── MigrationScriptExecutor.test.ts  (190+ tests)
```

### Test Doubles

- **Stubs** - Simple implementations (e.g., `SilentLogger`)
- **Mocks** - Sinon mocks for behavior verification
- **Fakes** - In-memory implementations for testing

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

const executor = new MigrationScriptExecutor(handler, {
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

const executor = new MigrationScriptExecutor(handler, {
    backupService: new S3BackupService()
});
```

### Custom Render Strategy

```typescript
import { IRenderStrategy, JsonRenderStrategy } from '@migration-script-runner/core';

// Use built-in JSON render strategy
const executor = new MigrationScriptExecutor(handler, {
    renderStrategy: new JsonRenderStrategy(true)  // pretty-printed JSON
});

// Or create a custom render strategy
class CustomRenderStrategy implements IRenderStrategy {
    renderMigrated(scripts, handler, limit) {
        console.log('Custom output:', scripts);
    }
    // ... implement other methods
}

const executor = new MigrationScriptExecutor(handler, {
    renderStrategy: new CustomRenderStrategy()
});
```

---

## Performance Considerations

### Parallel Operations

MSR uses `Promise.all()` for parallel operations where safe:

```typescript
// Parallel: Independent operations
const { migrated, all } = await Utils.promiseAll({
    migrated: schemaVersionService.getAllMigratedScripts(),
    all: migrationService.readMigrationScripts(config)
});

// Sequential: Dependent operations
await script.init();           // Must load first
const result = await script.up();  // Then execute
await schema.save(script);     // Then save
```

### Script Initialization

Scripts are initialized in parallel before execution:

```typescript
// Parallel init
await Promise.all(scripts.map(s => s.init()));

// Sequential execution
for (const script of scripts) {
    await executeOne(script);  // One at a time
}
```

---

## Best Practices

### Service Creation

✅ **Good:** Use dependency injection for testability
```typescript
new MigrationScriptExecutor(handler, {
    logger: mockLogger,
    backupService: mockBackup
});
```

❌ **Bad:** Direct instantiation inside services
```typescript
class MyService {
    constructor() {
        this.logger = new ConsoleLogger();  // Hard to test
    }
}
```

### Error Handling

✅ **Good:** Let errors propagate, handle at orchestration layer
```typescript
async executeOne(script) {
    return await script.up();  // Let errors bubble up
}
```

❌ **Bad:** Swallow errors silently
```typescript
async executeOne(script) {
    try {
        return await script.up();
    } catch (err) {
        // Silent failure - BAD!
    }
}
```

### State Management

✅ **Good:** Stateless services (pure functions)
```typescript
class MigrationScriptSelector {
    getTodo(migrated, all) {
        // No instance variables, pure logic
        return all.filter(...);
    }
}
```

❌ **Bad:** Stateful services with mutable state
```typescript
class BadSelector {
    private cache = [];  // Shared mutable state

    getTodo(migrated, all) {
        this.cache.push(...all);  // Side effects
    }
}
```

---

## Related Documentation

- [Getting Started](getting-started.md) - Quick start guide
- [Configuration](configuration.md) - Configuration options
- [Custom Logging](guides/custom-logging.md) - Logger implementation
- [Testing](testing/index.md) - Testing strategies
- [API Reference](api/index.md) - Complete API documentation

---

## Summary

MSR's architecture is designed for:
- **Clarity** - Each component has a clear, single purpose
- **Testability** - Dependency injection enables easy testing
- **Extensibility** - Open for extension via interfaces
- **Reliability** - Fail-fast with backup/restore guarantees
- **Maintainability** - Small, focused classes are easier to understand

The layered design with clear separation of concerns makes the codebase easy to navigate, test, and extend while maintaining backward compatibility.
