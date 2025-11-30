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

```typescript
import { MigrationScriptExecutor, IDatabaseMigrationHandler, Config } from '@migration-script-runner/core';

const handler = new MyDatabaseHandler();
const config = new Config();
const executor = new MigrationScriptExecutor(handler, config);
```

#### Constructor

```typescript
constructor(
    handler: IDatabaseMigrationHandler,
    config: Config,
    dependencies?: IMigrationExecutorDependencies
)
```

**Parameters:**
- `handler`: Database migration handler that implements `IDatabaseMigrationHandler`
- `config`: Configuration object (formerly accessed via `handler.cfg`)
- `dependencies` (optional): Custom service implementations for dependency injection
  - `logger?`: Custom logger implementation (defaults to `ConsoleLogger`)
  - `backupService?`: Custom backup service (defaults to `BackupService`)
  - `rollbackService?`: Custom rollback service (defaults to `RollbackService`)
  - `schemaVersionService?`: Custom schema version service (defaults to `SchemaVersionService`)
  - `migrationRenderer?`: Custom migration renderer (defaults to `MigrationRenderer`)
  - `migrationService?`: Custom migration service (defaults to `MigrationService`)
  - `migrationScanner?`: Custom migration scanner (defaults to `MigrationScanner`)
  - `validationService?`: Custom validation service (defaults to `MigrationValidationService`)
  - `renderStrategy?`: Custom render strategy (defaults to `AsciiTableRenderStrategy`)
  - `hooks?`: Lifecycle hooks for migration events (defaults to `undefined`)

{: .important }
> **Breaking Change (v0.3.0):** Config is now passed as a separate second parameter instead of being accessed from `handler.cfg`. This follows the Single Responsibility Principle and improves testability.

#### Public Properties

The `MigrationScriptExecutor` exposes several service instances as public readonly properties for direct access:

| Property | Type | Description |
|----------|------|-------------|
| `backupService` | `IBackupService` | Service for creating and managing database backups |
| `rollbackService` | `IRollbackService` | Service for handling rollback operations and strategies |
| `schemaVersionService` | `ISchemaVersionService` | Service for tracking executed migrations |
| `migrationRenderer` | `IMigrationRenderer` | Service for rendering migration output |
| `migrationService` | `IMigrationService` | Service for discovering migration script files |
| `migrationScanner` | `IMigrationScanner` | Service for gathering complete migration state |
| `validationService` | `IMigrationValidationService` | Service for validating migration scripts |
| `logger` | `ILogger` | Logger instance used across all services |
| `hooks` | `IMigrationHooks?` | Optional lifecycle hooks for migration events |

**Example (Accessing Services):**
```typescript
const executor = new MigrationScriptExecutor(handler, config);

// Check if backup should be created
if (executor.rollbackService.shouldCreateBackup()) {
  console.log('Backup will be created before migration');
}

// Access backup service directly
const backupPath = await executor.backupService.backup();

// Access validation service
const results = await executor.validationService.validateAll(scripts, config);
```

**Example (Custom Rollback Logic):**
```typescript
// Access rollbackService for custom workflows
const executor = new MigrationScriptExecutor(handler, config);

try {
  await executor.migrate();
} catch (error) {
  // Custom rollback decision logic
  if (shouldUseBackupRestore(error)) {
    await executor.rollbackService.rollback([], backupPath);
  } else {
    console.log('Skipping rollback for this error type');
  }
}
```

#### Methods

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

