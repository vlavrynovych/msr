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
└──┬──────────┬──────────┬──────────┬──────────┬─────────┬────────┘
   │          │          │          │          │         │
   ▼          ▼          ▼          ▼          ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌───────┐ ┌────────┐
│Backup  │ │Schema  │ │Migration│ │Migration │ │Migr.  │ │Migr.   │
│Service │ │Version │ │Service  │ │Renderer  │ │Scanner│ │Selector│
│        │ │Service │ │         │ │          │ │       │ │        │
└────────┘ └────────┘ └────────┘ └──────────┘ └───────┘ └────────┘
     │          │          │          │            │          │
     │          │          │          │            │          ▼
     │          │          │          │            │      ┌──────────────────┐
     │          │          │          │            │      │MigrationRunner   │
     │          │          │          │            │      │                  │
     │          │          │          │            │      └──────────────────┘
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
- `IBackupService` - Database backup/restore (optional, based on rollback strategy)
- `ISchemaVersionService` - Track executed migrations
- `IMigrationService` - Discover migration files
- `IMigrationScanner` - Gather complete migration state
- `IMigrationRenderer` - Display output
- `MigrationScriptSelector` - Filter migrations
- `MigrationRunner` - Execute migrations

**Location:** `src/service/MigrationScriptExecutor.ts`

```typescript
// Example usage
const config = new Config();
const executor = new MigrationScriptExecutor(handler, config, {
    logger: new SilentLogger(),  // Optional DI
    backupService: customBackup  // Optional DI
});

const result = await executor.migrate();
```

---

### MigrationScriptSelector

**Purpose:** Determines which migrations should be executed or rolled back

**Responsibilities:**
- Compare discovered scripts with executed migrations
- Filter out already-executed migrations
- Identify out-of-order migrations (ignored)
- Return pending migrations (for normal execution)
- Select migrations for version-specific operations (migrateTo/downTo)
- Select migrations for rollback operations

**Key Methods:**
- `getPending(migrated, all)` - Returns scripts to execute
- `getIgnored(migrated, all)` - Returns outdated scripts
- `getPendingUpTo(migrated, all, targetVersion)` - Returns scripts to execute up to target version
- `getMigratedDownTo(migrated, targetVersion)` - Returns scripts to rollback to reach target version
- `getMigratedInRange(migrated, fromVersion, toVersion)` - Returns scripts in version range

**Algorithm (getPending):**
```
1. Find max timestamp of executed migrations
2. Get scripts not in executed list
3. Filter: only scripts newer than max timestamp
4. Result: pending migrations to execute
```

**Algorithm (getPendingUpTo):**
```
1. Get pending migrations using getPending()
2. Filter: only scripts with timestamp <= targetVersion
3. Sort by timestamp (chronological order)
4. Result: migrations to execute to reach target version
```

**Algorithm (getMigratedDownTo):**
```
1. Get all executed migrations
2. Filter: only scripts with timestamp > targetVersion
3. Sort by timestamp (reverse chronological order)
4. Result: migrations to rollback to reach target version
```

**Location:** `src/service/MigrationScriptSelector.ts`

**Example:**
```typescript
const selector = new MigrationScriptSelector();

// migrated = [V1, V2, V5]
// all = [V1, V2, V3, V5, V6]
const pending = selector.getPending(migrated, all);
// → [V6]  (V3 ignored because < V5)

const ignored = selector.getIgnored(migrated, all);
// → [V3]  (older than last executed V5)

// Version control examples
const pendingUpTo = selector.getPendingUpTo(migrated, all, 6);
// → [V6]  (only V6, up to version 6)

const toRollback = selector.getMigratedDownTo(migrated, 2);
// → [V5]  (rollback V5 to reach version 2)
```

---

### MigrationScanner

**Purpose:** Gathers complete migration state from multiple sources

**Responsibilities:**
- Query database for executed migrations (parallel)
- Scan filesystem for migration scripts (parallel)
- Coordinate selector to identify pending migrations
- Coordinate selector to identify ignored migrations
- Return complete IScripts object with all migration states

**Key Methods:**
- `scan()` - Returns complete migration state: `{ all, migrated, pending, ignored, executed }`

**Architecture Benefits:**
- **Single Responsibility** - Separates state gathering from execution logic
- **Parallel Execution** - Database and filesystem queries run concurrently for performance
- **Testability** - Easy to test scanning logic independently from execution
- **Reusability** - Can use scanner in other contexts (reporting, analytics, dry-runs)

**Location:** `src/service/MigrationScanner.ts`

**Example:**
```typescript
const scanner = new MigrationScanner(
    migrationService,
    schemaVersionService,
    selector,
    handler
);

const scripts = await scanner.scan();
// Returns: {
//   all: MigrationScript[],       // All scripts found on filesystem
//   migrated: MigrationScript[],  // Scripts already executed in DB
//   pending: MigrationScript[],   // Scripts to execute (newer than last)
//   ignored: MigrationScript[],   // Scripts skipped (older than last)
//   executed: MigrationScript[]   // Scripts executed in current run
// }
```

**Dynamic Configuration:**
The scanner accepts `handler` instead of `config` to ensure it always uses the current configuration. This is critical for integration tests that modify config dynamically.

```typescript
// Good: Dynamic config access
constructor(private readonly handler: IDatabaseMigrationHandler) {}
all: this.migrationService.readMigrationScripts(this.handler.cfg)

// Bad: Config snapshot (would break dynamic tests)
constructor(private readonly config: Config) {}
all: this.migrationService.readMigrationScripts(this.config)
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
- Create backup before migrations (if BACKUP or BOTH strategy)
- Restore backup on failure (if BACKUP strategy)
- Fallback restore if down() fails (if BOTH strategy)
- Delete backup after success or failure
- Handle backup lifecycle

**Location:** `src/service/BackupService.ts`

**Note:** Only used when `rollbackStrategy` is BACKUP or BOTH. Not required for DOWN or NONE strategies.

**Workflow (BACKUP strategy):**
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

**Workflow (DOWN strategy):**
```
migrate() {
  // No backup created
  try {
    run migrations
  } catch (err) {
    rollbackWithDown()  // ← Call down() on all attempted migrations
  }
}
```

**Workflow (BOTH strategy):**
```
migrate() {
  backup()           // ← BackupService
  try {
    run migrations
    deleteBackup()   // ← Success: remove backup
  } catch (err) {
    try {
      rollbackWithDown()  // ← Try down() first
      deleteBackup()
    } catch (downErr) {
      restore()        // ← Fallback to backup
      deleteBackup()
    }
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
   ├─▶ 4. MigrationScanner.scan()
   │      └─▶ Parallel execution:
   │          ├─▶ MigrationService.readMigrationScripts()
   │          │   └─▶ Discovers all .ts/.js files in migrations/
   │          │
   │          └─▶ SchemaVersionService.getAllMigratedScripts()
   │              └─▶ Queries schema_version table
   │
   │      └─▶ Sequential filtering:
   │          ├─▶ MigrationScriptSelector.getPending()
   │          │   └─▶ Filters: new scripts > last executed
   │          │
   │          └─▶ MigrationScriptSelector.getIgnored()
   │              └─▶ Filters: old scripts < last executed
   │
   ├─▶ 5. MigrationRenderer.drawMigrated()
   │      └─▶ Display already-executed migrations
   │
   ├─▶ 6. MigrationRenderer.drawIgnored()
   │      └─▶ Display skipped migrations
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

## Migration Script Lifecycle

### States

```
┌─────────────┐
│ Discovered  │  ← MigrationService finds file
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Filtered   │  ← MigrationScriptSelector: pending/ignored/migrated
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

### Error Flow (with Rollback Strategies)

```
try {
  // Conditional backup based on strategy
  if (strategy === BACKUP || strategy === BOTH) {
    await backup.create()
  }

  await schema.init()
  await runner.execute(scripts)  // ← Error here

  if (backupPath) {
    backup.delete()
  }
  return { success: true }

} catch (error) {
  // Handle rollback based on configured strategy
  switch (strategy) {
    case BACKUP:
      await backup.restore()
      break

    case DOWN:
      await rollbackWithDown(executedScripts)
      break

    case BOTH:
      try {
        await rollbackWithDown(executedScripts)
      } catch (downError) {
        await backup.restore()  // Fallback
      }
      break

    case NONE:
      logger.warn('No rollback configured')
      break
  }

  if (backupPath) {
    backup.delete()  // Cleanup
  }

  return {
    success: false,
    errors: [error]
  }
}
```

### Recovery Process

#### BACKUP Strategy
1. **Error Occurs** - Migration script throws exception
2. **Stop Execution** - Remaining scripts not executed
3. **Restore Backup** - Database rolled back to pre-migration state
4. **Delete Backup** - Cleanup temporary backup file
5. **Return Result** - Report failure with error details

#### DOWN Strategy
1. **Error Occurs** - Migration script throws exception
2. **Stop Execution** - Remaining scripts not executed
3. **Call down() Methods** - Execute down() on all attempted migrations in reverse order
4. **Return Result** - Report failure with error details

#### BOTH Strategy
1. **Error Occurs** - Migration script throws exception
2. **Stop Execution** - Remaining scripts not executed
3. **Try down() First** - Attempt to rollback using down() methods
4. **Fallback to Backup** - If down() fails, restore from backup
5. **Delete Backup** - Cleanup temporary backup file
6. **Return Result** - Report failure with error details

#### NONE Strategy
1. **Error Occurs** - Migration script throws exception
2. **Stop Execution** - Remaining scripts not executed
3. **Log Warning** - No rollback performed, database may be inconsistent
4. **Return Result** - Report failure with error details

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
  ├── MigrationScanner.test.ts         (11 tests)
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

## Performance Considerations

### Parallel Operations

MSR uses `Promise.all()` for parallel operations where safe:

```typescript
// Parallel: Independent operations (in MigrationScanner)
const { migrated, all } = await Utils.promiseAll({
    migrated: schemaVersionService.getAllMigratedScripts(),
    all: migrationService.readMigrationScripts(handler.cfg)
});

// Sequential: Dependent operations
await script.init();           // Must load first
const result = await script.up();  // Then execute
await schema.save(script);     // Then save
```

**Performance Benefit:** The MigrationScanner executes database and filesystem queries in parallel, significantly reducing startup time for large projects with many migrations. For example:
- Sequential: 500ms (DB query) + 300ms (FS scan) = 800ms
- Parallel: max(500ms, 300ms) = 500ms (38% faster)

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
new MigrationScriptExecutor(handler, config, {
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
    getPending(migrated, all) {
        // No instance variables, pure logic
        return all.filter(...);
    }
}
```

❌ **Bad:** Stateful services with mutable state
```typescript
class BadSelector {
    private cache = [];  // Shared mutable state

    getPending(migrated, all) {
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
