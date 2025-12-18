---
layout: default
title: Core Classes
parent: API Reference
nav_order: 1
---

# Core Classes
{: .no_toc }

The main classes for executing and managing migrations.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

### MigrationScriptExecutor

The main class for executing database migrations.

**Generic Type Parameters:**
- **v0.6.0:** Database type parameter (`DB extends IDB`) provides database-specific type safety
- **v0.8.0:** Handler type parameter (`THandler extends IDatabaseMigrationHandler<DB>`) provides type-safe handler access in adapters

```typescript
import { MigrationScriptExecutor, IDatabaseMigrationHandler, Config, IDB } from '@migration-script-runner/core';

// Define your database type
interface IMyDatabase extends IDB {
  query(sql: string): Promise<any>;
}

// Basic usage - handler type inferred
const handler = new MyDatabaseHandler();  // implements IDatabaseMigrationHandler<IMyDatabase>
const config = new Config();
const executor = new MigrationScriptExecutor<IMyDatabase>({ handler , config });

// v0.8.0: Type-safe adapter with handler generic (for custom adapters)
class MyAdapter extends MigrationScriptExecutor<IMyDatabase, MyDatabaseHandler> {
  // this.handler is now typed as MyDatabaseHandler (no casting needed!)
  getConnectionInfo() {
    return this.handler.customProperty;  // Full IDE autocomplete
  }
}
```

#### Constructor

**Signature (v0.8.0+):**
```typescript
constructor<
    DB extends IDB,
    THandler extends IDatabaseMigrationHandler<DB> = IDatabaseMigrationHandler<DB>
>(
    dependencies: IMigrationExecutorDependencies<DB, THandler>
)
```

**Signature (v0.7.0 - v0.7.x):**
```typescript
constructor<DB extends IDB>(
    dependencies: IMigrationExecutorDependencies<DB>
)
```

**Old Signature (v0.6.x - REMOVED):**
```typescript
constructor<DB extends IDB>(
    dependencies: IMigrationExecutorDependencies<DB>,
    config?: Config
)
```

**Parameters (v0.7.0+):**
- `dependencies`: Object containing required and optional dependencies
  - `handler` (required): Database migration handler implementing `IDatabaseMigrationHandler<DB>`
  - `config?`: Configuration object (defaults to `ConfigLoader.load()` if not provided) - **MOVED from second parameter in v0.7.0**
  - `configLoader?`: Custom config loader implementing `IConfigLoader` (defaults to `ConfigLoader`) - **NEW in v0.7.0**
  - `logger?`: Custom logger implementation (defaults to `ConsoleLogger`). **Note:** Automatically wrapped with `LevelAwareLogger` for log level filtering based on `config.logLevel`
  - `backupService?`: Custom backup service implementing `IBackupService` (defaults to `BackupService<DB>`)
  - `rollbackService?`: Custom rollback service implementing `IRollbackService<DB>` (defaults to `RollbackService<DB>`)
  - `schemaVersionService?`: Custom schema version service implementing `ISchemaVersionService<DB>` (defaults to `SchemaVersionService<DB>`)
  - `migrationRenderer?`: Custom migration renderer implementing `IMigrationRenderer<DB>` (defaults to `MigrationRenderer<DB>`)
  - `migrationService?`: Custom migration service implementing `IMigrationService<DB>` (defaults to `MigrationService<DB>`)
  - `migrationScanner?`: Custom migration scanner implementing `IMigrationScanner<DB>` (defaults to `MigrationScanner<DB>`)
  - `validationService?`: Custom validation service implementing `IMigrationValidationService<DB>` (defaults to `MigrationValidationService<DB>`)
  - `renderStrategy?`: Custom render strategy implementing `IRenderStrategy<DB>` (defaults to `AsciiTableRenderStrategy<DB>`)
  - `hooks?`: Lifecycle hooks for migration events implementing `IMigrationHooks<DB>` (defaults to `undefined`)
  - `metricsCollectors?`: Array of metrics collectors implementing `IMetricsCollector[]` (defaults to `[]`)
  - `loaderRegistry?`: Custom loader registry implementing `ILoaderRegistry<DB>` (defaults to `LoaderRegistry.createDefault()`)

{: .important }
> **Breaking Change (v0.7.0):** Constructor now takes single parameter. Config moved from second parameter into `dependencies.config`. This improves adapter ergonomics and enables extensible configuration loading via `configLoader`.

{: .important }
> **Breaking Change (v0.6.0):** Constructor signature changed to use dependency injection pattern with `{ handler }` object syntax. Handler is now required in dependencies object as first parameter. Config is now optional (auto-loads if not provided). Generic type parameter `<DB extends IDB>` provides database-specific type safety.

#### Public API

The `MigrationScriptExecutor` provides high-level methods for migration operations. Services are not exposed as public properties - use the documented public methods instead (e.g., `createBackup()`, `restoreFromBackup()`, `validate()`).

#### Methods

##### getHandler()

Get the database migration handler instance.

{: .new }
> **NEW in v0.8.1:** Provides external access to the handler for CLI operations and custom commands.

```typescript
executor.getHandler(): THandler
```

**Returns:** `THandler` - The database migration handler instance, fully typed according to the THandler generic parameter

**Behavior:**
- Returns the handler passed to the constructor
- Preserves full type information through THandler generic
- Enables CLI custom commands to access handler functionality
- Allows external code to access handler properties and methods

**Use Cases:**
- CLI custom commands that need database operations
- Accessing handler configuration or metadata
- Type-safe handler access with THandler generic parameter
- Custom integrations that need direct handler access

**Example (Basic Handler Access):**
```typescript
const executor = new MigrationScriptExecutor({ handler, config });
const h = executor.getHandler();

console.log(`Database: ${h.getName()}`);
console.log(`Version: ${h.getVersion()}`);
```

**Example (CLI Custom Commands):**
```typescript
import { createCLI } from '@migration-script-runner/core';

const program = createCLI({
  createExecutor: (config) => new MigrationScriptExecutor({ handler, config }),
  extendCLI: (program, createExecutor) => {
    program
      .command('vacuum')
      .description('Run VACUUM ANALYZE on database')
      .action(async () => {
        const executor = createExecutor();
        const handler = executor.getHandler();

        // Direct database operation
        await handler.db.query('VACUUM ANALYZE');
        console.log('✓ Vacuum completed');
      });

    program
      .command('connection-info')
      .description('Display database connection details')
      .action(async () => {
        const executor = createExecutor();
        const handler = executor.getHandler();

        console.log(`Database: ${handler.getName()}`);
        console.log(`Version: ${handler.getVersion()}`);
      });
  }
});
```

**Example (Type-Safe Adapter with THandler Generic):**
```typescript
// Define custom handler interface
interface PostgresHandler extends IDatabaseMigrationHandler<IDB> {
  pool: { totalCount: number; idleCount: number };
  getConnectionInfo(): { host: string; port: number };
}

// Create adapter with THandler generic
class PostgresAdapter extends MigrationScriptExecutor<IDB, PostgresHandler> {
  displayPoolStats() {
    // Internal: this.handler is typed as PostgresHandler
    console.log(`Pool size: ${this.handler.pool.totalCount}`);
  }
}

// External access is also type-safe
const adapter = new PostgresAdapter({ handler: postgresHandler, config });
const handler = adapter.getHandler();  // Typed as PostgresHandler!

console.log(`Idle connections: ${handler.pool.idleCount}`);
const info = handler.getConnectionInfo();  // ✓ Full type safety!
console.log(`Connected to ${info.host}:${info.port}`);
```

{: .note }
> Prior to v0.8.1, adapters needed custom `getHandler()` methods to expose the handler. This is now provided by the base class, removing the need for adapter-specific workarounds.

---

##### migrate()

Execute all pending migrations and return a structured result.

```typescript
await executor.migrate(): Promise<IMigrationResult>
```

**Returns:** `Promise<IMigrationResult>` containing:
- `success`: `boolean` - Whether all migrations completed successfully
- `executed`: `MigrationScript[]` - Migrations executed during this run
- `migrated`: `MigrationScript[]` - Previously executed migrations from database history
- `ignored`: `MigrationScript[]` - Migrations with timestamps older than the last executed
- `errors?`: `Error[]` - Array of errors if any occurred (only present when success is false)

**Example (Library Usage):**
```typescript
import { IMigrationResult } from '@migration-script-runner/core';

const result: IMigrationResult = await executor.migrate();

if (result.success) {
  console.log(`✅ Successfully executed ${result.executed.length} migrations`);
  console.log(`📋 Total migrated: ${result.migrated.length}`);
  // Continue with application startup
  startServer();
} else {
  console.error('❌ Migration failed:', result.errors);
  // Handle error gracefully without terminating process
  await sendAlert(result.errors);
}
```

**Example (CLI Usage):**
```typescript
const result = await executor.migrate();
process.exit(result.success ? 0 : 1);
```

{: .note }
> **Breaking Change (v0.3.0):** The `migrate()` method now returns a `Promise<IMigrationResult>` instead of `Promise<void>`. It no longer calls `process.exit()` internally, making MSR safe to use as a library in long-running applications like web servers.

---

##### list()

Display all migrations with their execution status.

```typescript
await executor.list(number?: number): Promise<void>
```

**Parameters:**
- `number` (optional): Maximum number of migrations to display (0 = all). Defaults to 0.

**Prints a formatted table showing:**
- Timestamp and name of each migration
- Execution date/time for completed migrations
- Duration of execution
- Whether the migration file still exists locally

**Example:**
```typescript
// List all migrations
await executor.list();

// List only the last 10 migrations
await executor.list(10);

// Outputs:
// +-------------+------------------+----------+----------+
// | Timestamp   | Name             | Executed | Duration |
// +-------------+------------------+----------+----------+
// | 202501220100| initial_setup    | ...      | 0.5s     |
// +-------------+------------------+----------+----------+
```

---

##### up()

Execute all pending migrations or migrate to a specific target version.

```typescript
// Execute all pending migrations
await executor.up(): Promise<IMigrationResult>

// Execute migrations up to a specific target version
await executor.up(targetVersion: number): Promise<IMigrationResult>
```

**Parameters:**
- `targetVersion` (optional): The target version timestamp to migrate to (inclusive). If omitted, executes all pending migrations.

**Returns:** `Promise<IMigrationResult>` containing:
- `success`: `boolean` - Whether all migrations completed successfully
- `executed`: `MigrationScript[]` - Migrations executed during this run
- `migrated`: `MigrationScript[]` - Previously executed migrations from database history
- `ignored`: `MigrationScript[]` - Migrations with timestamps older than the last executed
- `errors?`: `Error[]` - Array of errors if any occurred (only present when success is false)

**Behavior:**
- Without parameter: Executes all pending migrations
- With targetVersion: Only executes migrations with timestamps <= targetVersion
- Skips if database is already at or beyond target version
- Creates backup before execution (if rollback strategy requires it)
- Executes beforeMigrate script if configured
- Saves migration state immediately after each execution
- Triggers rollback on failure according to configured strategy

{: .important }
> **v0.4.0 API Change:** This replaces `migrate()` and `migrateTo(targetVersion)`. The `migrate()` method still works as an alias.

**Example (Execute All Migrations):**
```typescript
const result = await executor.up();

if (result.success) {
  console.log(`✅ Executed ${result.executed.length} migrations`);
} else {
  console.error('❌ Migration failed:', result.errors);
  process.exit(1);
}
```

**Example (Controlled Deployment):**
```typescript
// Deploy up to specific version in production
const targetVersion = 202501220100;
const result = await executor.up(targetVersion);

if (result.success) {
  console.log(`✅ Database migrated to version ${targetVersion}`);
  console.log(`Executed ${result.executed.length} migrations`);
} else {
  console.error('❌ Migration failed:', result.errors);
  process.exit(1);
}
```

**Example (Partial Deployment):**
```typescript
// Deploy only migrations up to a specific point
// Useful for testing or staged deployments
const result = await executor.up(202501220300);

// Later, continue to next version
const result2 = await executor.up(202501220500);
```

{: .note }
> Migrations are saved to the database immediately after execution, ensuring the schema version table stays synchronized even if later migrations fail.

---

##### validate()

Validate pending and executed migrations without running them.

```typescript
await executor.validate(): Promise<{pending: IValidationResult[], migrated: IValidationIssue[]}>
```

**Returns:** Object containing:
- `pending`: `IValidationResult[]` - Validation results for pending migrations
- `migrated`: `IValidationIssue[]` - Integrity check issues for executed migrations

**Behavior:**
- Validates structure and interface of pending migrations
- Validates integrity of already-executed migrations (checksums, file existence)
- Checks down() method requirements based on rollback strategy
- Runs custom validators if configured
- Does NOT execute migrations or connect to database for initialization

**Throws:** `ValidationError` if validation fails (errors found or warnings in strict mode)

**Example (CI/CD Pipeline):**
```typescript
try {
  await executor.validate();
  console.log('✓ All migrations are valid');
} catch (error) {
  console.error('❌ Migration validation failed:', error.message);
  process.exit(1);
}
```

---

##### createBackup()

Manually create a database backup.

```typescript
await executor.createBackup(): Promise<string>
```

**Returns:** `Promise<string>` - Absolute path to the created backup file

**Behavior:**
- Creates backup using configured backup settings
- Useful for manual backup workflows or when using `BackupMode.MANUAL`
- Backup file path follows configured naming conventions

**Example (Manual Backup Workflow):**
```typescript
import { BackupMode } from '@migration-script-runner/core';

// Configure for manual control
config.backupMode = BackupMode.MANUAL;

// Create backup manually
const backupPath = await executor.createBackup();
console.log(`Backup created: ${backupPath}`);

try {
  await executor.up();
  executor.deleteBackup();
} catch (error) {
  // Restore from backup on failure
  await executor.restoreFromBackup(backupPath);
}
```

**Example (Custom Backup Timing):**
```typescript
// Create backup before risky operation
const preUpdateBackup = await executor.createBackup();

// Perform operation
await performRiskyUpdate();

// Create another backup after
const postUpdateBackup = await executor.createBackup();
```

---

##### restoreFromBackup()

Restore database from a backup file.

```typescript
await executor.restoreFromBackup(backupPath?: string): Promise<void>
```

**Parameters:**
- `backupPath` (optional): Path to backup file. If not provided, uses the most recent backup created by `createBackup()`.

**Behavior:**
- Restores database to the state captured in the backup file
- Can restore from specific backup path or most recent backup
- Useful for manual restore workflows or selective restore based on conditions

**Example (Restore from Specific Backup):**
```typescript
await executor.restoreFromBackup('./backups/backup-2025-01-22.bkp');
```

**Example (Restore from Most Recent):**
```typescript
const backupPath = await executor.createBackup();
// ... migrations fail ...
await executor.restoreFromBackup(); // Uses backupPath automatically
```

**Example (Conditional Restore):**
```typescript
const backupPath = await executor.createBackup();
try {
  await executor.up();
} catch (error) {
  // Only restore for certain error types
  if (shouldRestore(error)) {
    await executor.restoreFromBackup(backupPath);
  }
}
```

---

##### deleteBackup()

Delete the backup file from disk.

```typescript
executor.deleteBackup(): void
```

**Behavior:**
- Only deletes if `config.backup.deleteBackup` is `true`
- Safe to call multiple times (no error if file already deleted)
- Useful for manual cleanup after successful migrations

**Example (Manual Cleanup):**
```typescript
const backupPath = await executor.createBackup();
await executor.up();
executor.deleteBackup(); // Clean up after success
```

**Example (Conditional Cleanup):**
```typescript
config.backup.deleteBackup = true;
const backupPath = await executor.createBackup();

try {
  await executor.up();
  executor.deleteBackup(); // Auto-respects config
} catch (error) {
  // Keep backup for investigation
  console.log(`Backup preserved at: ${backupPath}`);
}
```

---

##### down()

Roll back migrations to a specific target version.

```typescript
await executor.down(targetVersion: number): Promise<IMigrationResult>
```

**Parameters:**
- `targetVersion`: The target version timestamp to downgrade to (migrations newer than this will be rolled back)

**Returns:** `Promise<IMigrationResult>` containing:
- `success`: `boolean` - Whether rollback completed successfully
- `executed`: `MigrationScript[]` - Migrations that were rolled back (empty after successful rollback)
- `migrated`: `MigrationScript[]` - Remaining migrations after rollback
- `ignored`: `MigrationScript[]` - Ignored migrations (typically empty for down)
- `errors?`: `Error[]` - Array of errors if any occurred (only present when success is false)

**Behavior:**
- Rolls back all migrations with timestamps > targetVersion
- Executes down() methods in reverse chronological order (newest first)
- Removes migration records from schema version table after successful rollback
- Throws error if any migration is missing a down() method
- Skips if database is already at or below target version

**Requirements:**
- All migrations to be rolled back **must** implement the `down()` method
- down() methods must be idempotent (safe to run multiple times)

{: .important }
> **v0.4.0 API Change:** This replaces `downTo(targetVersion)`. Method renamed to `down()` for clarity and consistency with `up()`.

**Example (Rollback to Specific Version):**
```typescript
// Current database version: 202501220300
// Rollback to version 202501220100
const result = await executor.down(202501220100);

if (result.success) {
  console.log(`✅ Rolled back to version 202501220100`);
  console.log(`Removed ${result.executed.length} migrations`);
} else {
  console.error('❌ Rollback failed:', result.errors);
  process.exit(1);
}
```

**Example (Complete Rollback):**
```typescript
// Rollback all migrations (return to empty database)
const result = await executor.down(0);

if (result.success) {
  console.log('✅ All migrations rolled back');
  console.log('Database returned to initial state');
}
```

**Example (Round-trip Migration for Testing):**
```typescript
// Test that migrations can be applied and rolled back
const upResult = await executor.up(202501220300);
console.log(`Applied ${upResult.executed.length} migrations`);

// Verify database state
await verifyDatabaseState();

// Rollback
const downResult = await executor.down(0);
console.log(`Rolled back ${downResult.executed.length} migrations`);
```

{: .warning }
> The rollback process calls `down()` methods in reverse chronological order and removes migration records from the schema version table. Ensure your down() methods properly reverse all changes made by the corresponding up() methods.

{: .important }
> If a migration is missing a down() method, `down()` will throw an error and stop. All migrations must implement down() if you plan to use rollback functionality.

---

