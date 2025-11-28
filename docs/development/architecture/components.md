---
layout: default
title: Core Components
parent: Architecture
nav_order: 1
---

# Core Components
{: .no_toc }

Detailed documentation of MSR's core classes and services.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## High-Level Architecture

This component diagram shows the relationships between MSR's core services and how they interact with your database handler:

```mermaid
graph TB
    subgraph "User Layer"
        App[User Application<br/>Your migration code]
        Scripts[Migration Scripts<br/>V*_*.ts files]
    end

    subgraph "Orchestration Layer"
        Executor[MigrationScriptExecutor<br/>Main orchestrator]
        Config[Config<br/>Settings]
    end

    subgraph "Service Layer"
        Scanner[MigrationScanner<br/>Gathers state]
        Selector[MigrationScriptSelector<br/>Filters migrations]
        Runner[MigrationRunner<br/>Executes scripts]
        Validator[MigrationValidator<br/>Validates scripts]
        Backup[BackupService<br/>Creates backups]
        Schema[SchemaVersionService<br/>Tracks history]
        Rollback[RollbackService<br/>Handles failures]
        Renderer[MigrationRenderer<br/>Formats output]
    end

    subgraph "Database Layer"
        Handler[IDatabaseMigrationHandler<br/>Your database handler]
        DB[(Your Database<br/>PostgreSQL/MongoDB/etc)]
    end

    App --> Executor
    Executor --> Config
    Executor --> Scanner
    Executor --> Validator
    Executor --> Backup
    Executor --> Rollback
    Executor --> Renderer

    Scanner --> Selector
    Scanner --> Schema
    Scanner --> MigrationService[MigrationService<br/>Discovers files]

    Executor --> Runner
    Runner --> Scripts
    Runner --> Schema

    Backup --> Handler
    Schema --> Handler
    Rollback --> Handler
    Rollback --> Backup
    MigrationService --> Scripts

    Scripts --> DB
    Handler --> DB

    Renderer --> Strategy[IRenderStrategy<br/>ASCII/JSON/Silent]
    Renderer --> Logger[ILogger<br/>Console/File/Silent]

    style App fill:#e1f5ff
    style Scripts fill:#e1f5ff
    style Executor fill:#fff3cd
    style Config fill:#fff3cd
    style Scanner fill:#d4edda
    style Selector fill:#d4edda
    style Runner fill:#d4edda
    style Validator fill:#d4edda
    style Backup fill:#d4edda
    style Schema fill:#d4edda
    style Rollback fill:#d4edda
    style Renderer fill:#d4edda
    style MigrationService fill:#d4edda
    style Handler fill:#f8d7da
    style DB fill:#f8d7da
    style Strategy fill:#e8e8e8
    style Logger fill:#e8e8e8
```

**Layer Responsibilities:**
- **Blue (User Layer)**: Your application code and migration scripts
- **Yellow (Orchestration)**: Main coordinator and configuration
- **Green (Service Layer)**: Specialized services with focused responsibilities
- **Pink (Database Layer)**: Your database handler and database
- **Gray (Output)**: Rendering and logging strategies

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
- `IBackupService` - Database backup/restore operations
- `ISchemaVersionService` - Track executed migrations
- `IRollbackService` - Handle rollback strategies and failure recovery
- `IMigrationService` - Discover migration files
- `IMigrationScanner` - Gather complete migration state
- `IMigrationRenderer` - Display output
- `MigrationScriptSelector` - Filter migrations
- `MigrationRunner` - Execute migrations
- `IMigrationValidationService` - Validate migration scripts

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

### RollbackService

**Purpose:** Orchestrate rollback operations based on configured strategy

**Responsibilities:**
- Determine if backup should be created based on strategy and mode
- Execute rollback using one of four strategies (BACKUP, DOWN, BOTH, NONE)
- Handle backup mode logic (FULL, CREATE_ONLY, RESTORE_ONLY, MANUAL)
- Coordinate with BackupService for backup/restore operations
- Call lifecycle hooks during rollback (onBeforeRestore, onAfterRestore)

**Location:** `src/service/RollbackService.ts`

**Rollback Strategies:**
- **BACKUP** - Restore from backup file
- **DOWN** - Call down() methods in reverse order
- **BOTH** - Try DOWN first, fallback to BACKUP if it fails
- **NONE** - No rollback (logs warning)

**Backup Modes (affect BACKUP/BOTH strategies):**
- **FULL** - Create backup before migration, restore on failure
- **CREATE_ONLY** - Create backup but don't restore on failure
- **RESTORE_ONLY** - Don't create backup, restore from existing backup path
- **MANUAL** - Don't create or restore (use createBackup/restoreFromBackup methods manually)

**Key Method:**
```typescript
async rollback(
    executedScripts: MigrationScript[],
    backupPath?: string
): Promise<void>
```

**Example Usage:**
```typescript
const rollbackService = new RollbackService(
    handler,
    config,
    backupService,
    logger,
    hooks
);

try {
    await runMigrations();
} catch (error) {
    // Automatically rollback using configured strategy
    await rollbackService.rollback(executedScripts, backupPath);
}
```

---

### BackupService

**Purpose:** Create and manage database backup files

**Responsibilities:**
- Create backup by calling handler.backup.backup()
- Write backup data to disk with timestamp
- Restore backup by calling handler.backup.restore()
- Delete backup after success or cleanup
- Handle backup file lifecycle

**Location:** `src/service/BackupService.ts`

**Note:** Used by RollbackService when rollbackStrategy is BACKUP or BOTH.

**Workflow (BACKUP strategy - orchestrated by RollbackService):**
```
migrate() {
  if (rollbackService.shouldCreateBackup()) {
    backup()         // ← BackupService
  }
  try {
    run migrations
    deleteBackup()   // ← Success: remove backup
  } catch (err) {
    rollbackService.rollback(executedScripts, backupPath)
    // → RollbackService calls restore() via BackupService
  }
}
```

**Workflow (DOWN strategy - orchestrated by RollbackService):**
```
migrate() {
  // No backup created (shouldCreateBackup() returns false)
  try {
    run migrations
  } catch (err) {
    rollbackService.rollback(executedScripts, backupPath)
    // → RollbackService calls down() on all attempted migrations
  }
}
```

**Workflow (BOTH strategy - orchestrated by RollbackService):**
```
migrate() {
  if (rollbackService.shouldCreateBackup()) {
    backup()         // ← BackupService
  }
  try {
    run migrations
    deleteBackup()   // ← Success: remove backup
  } catch (err) {
    rollbackService.rollback(executedScripts, backupPath)
    // → RollbackService tries down() first, falls back to backup restore if down() fails
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

