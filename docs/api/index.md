---
layout: default
title: API Reference
nav_order: 4
has_children: false
---

# API Reference
{: .no_toc }

Complete API documentation for Migration Script Runner.
{: .fs-6 .fw-300 }

{: .note }
> This is a comprehensive manual API reference. All public APIs also include JSDoc comments in the source code for IDE intellisense support.

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Core Classes

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
  - `schemaVersionService?`: Custom schema version service (defaults to `SchemaVersionService`)
  - `migrationRenderer?`: Custom migration renderer (defaults to `MigrationRenderer`)
  - `migrationService?`: Custom migration service (defaults to `MigrationService`)
  - `renderStrategy?`: Custom render strategy (defaults to `AsciiTableRenderStrategy`)
  - `hooks?`: Lifecycle hooks for migration events (defaults to `undefined`)

{: .important }
> **Breaking Change (v0.3.0):** Config is now passed as a separate second parameter instead of being accessed from `handler.cfg`. This follows the Single Responsibility Principle and improves testability.

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

##### migrateTo()

Execute migrations up to a specific target version.

```typescript
await executor.migrateTo(targetVersion: number): Promise<IMigrationResult>
```

**Parameters:**
- `targetVersion`: The target version timestamp to migrate to (inclusive)

**Returns:** `Promise<IMigrationResult>` containing:
- `success`: `boolean` - Whether all migrations completed successfully
- `executed`: `MigrationScript[]` - Migrations executed during this run
- `migrated`: `MigrationScript[]` - Previously executed migrations from database history
- `ignored`: `MigrationScript[]` - Migrations with timestamps older than the last executed
- `errors?`: `Error[]` - Array of errors if any occurred (only present when success is false)

**Behavior:**
- Only executes migrations with timestamps <= targetVersion
- Skips if database is already at or beyond target version
- Creates backup before execution (if rollback strategy requires it)
- Executes beforeMigrate script if configured
- Saves migration state immediately after each execution
- Triggers rollback on failure according to configured strategy

**Example (Controlled Deployment):**
```typescript
// Deploy up to specific version in production
const targetVersion = 202501220100;
const result = await executor.migrateTo(targetVersion);

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
const result = await executor.migrateTo(202501220300);

// Later, continue to next version
const result2 = await executor.migrateTo(202501220500);
```

{: .note }
> Migrations are saved to the database immediately after execution, ensuring the schema version table stays synchronized even if later migrations fail.

---

##### downTo()

Roll back migrations to a specific target version.

```typescript
await executor.downTo(targetVersion: number): Promise<IMigrationResult>
```

**Parameters:**
- `targetVersion`: The target version timestamp to downgrade to (migrations newer than this will be rolled back)

**Returns:** `Promise<IMigrationResult>` containing:
- `success`: `boolean` - Whether rollback completed successfully
- `executed`: `MigrationScript[]` - Migrations that were rolled back (empty after successful rollback)
- `migrated`: `MigrationScript[]` - Remaining migrations after rollback
- `ignored`: `MigrationScript[]` - Ignored migrations (typically empty for downTo)
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

**Example (Rollback to Specific Version):**
```typescript
// Current database version: 202501220300
// Rollback to version 202501220100
const result = await executor.downTo(202501220100);

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
const result = await executor.downTo(0);

if (result.success) {
  console.log('✅ All migrations rolled back');
  console.log('Database returned to initial state');
}
```

**Example (Round-trip Migration for Testing):**
```typescript
// Test that migrations can be applied and rolled back
const upResult = await executor.migrateTo(202501220300);
console.log(`Applied ${upResult.executed.length} migrations`);

// Verify database state
await verifyDatabaseState();

// Rollback
const downResult = await executor.downTo(0);
console.log(`Rolled back ${downResult.executed.length} migrations`);
```

{: .warning }
> The rollback process calls `down()` methods in reverse chronological order and removes migration records from the schema version table. Ensure your down() methods properly reverse all changes made by the corresponding up() methods.

{: .important }
> If a migration is missing a down() method, `downTo()` will throw an error and stop. All migrations must implement down() if you plan to use rollback functionality.

---

## Configuration Classes

### Config

Main configuration class.

```typescript
import { Config } from '@migration-script-runner/core';

const config = new Config();
```

#### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `folder` | `string` | `./migrations` | Migration scripts directory |
| `filePattern` | `RegExp` | `/^V(\d+)_(.+)\.ts$/` | Filename pattern for migrations |
| `tableName` | `string` | `schema_version` | Database table for tracking migrations |
| `displayLimit` | `number` | `0` | Max migrations to display (0 = all) |
| `beforeMigrateName` | `string \| null` | `'beforeMigrate'` | Name of setup script that runs before migrations (set to `null` to disable) |
| `recursive` | `boolean` | `true` | Enable recursive scanning of sub-folders |
| `rollbackStrategy` | `RollbackStrategy` | `RollbackStrategy.BACKUP` | Rollback strategy on migration failure |
| `backup` | `BackupConfig` | `new BackupConfig()` | Backup configuration (required for BACKUP/BOTH strategies) |

See [Configuration Guide](../configuration) for detailed examples.

---

### BackupConfig

Backup system configuration.

```typescript
import { BackupConfig } from '@migration-script-runner/core';

const backupConfig = new BackupConfig();
```

#### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `folder` | `string` | `./backups` | Backup directory |
| `deleteBackup` | `boolean` | `true` | Delete backup after successful migration |
| `timestamp` | `boolean` | `true` | Include timestamp in filename |
| `timestampFormat` | `string` | `YYYY-MM-DD-HH-mm-ss` | Moment.js format for timestamp |
| `prefix` | `string` | `backup` | Filename prefix |
| `filename` | `string` | `''` | Custom filename component |
| `suffix` | `string` | `''` | Filename suffix |
| `ext` | `string` | `.bkp` | File extension |

---

### RollbackStrategy

Enum that defines rollback behavior when a migration fails.

```typescript
enum RollbackStrategy {
  BACKUP = 'BACKUP',
  DOWN = 'DOWN',
  BOTH = 'BOTH',
  NONE = 'NONE'
}
```

#### Values

| Value | Description | Requires Backup | Requires down() |
|-------|-------------|-----------------|-----------------|
| `BACKUP` | Traditional backup/restore (default) | ✅ Yes | ❌ No |
| `DOWN` | Call down() methods in reverse order | ❌ No | ✅ Yes |
| `BOTH` | Try down() first, fallback to backup | ✅ Yes | ⚠️  Recommended |
| `NONE` | No rollback, logs warning | ❌ No | ❌ No |

**Usage:**
```typescript
import { RollbackStrategy } from '@migration-script-runner/core';

config.rollbackStrategy = RollbackStrategy.DOWN;
```

See [Configuration Guide](../configuration#rollbackstrategy) for detailed usage.

---

## Interfaces

### IDatabaseMigrationHandler

Interface that must be implemented for your specific database.

```typescript
interface IDatabaseMigrationHandler {
  getName(): string;
  db: IDB;
  schemaVersion: ISchemaVersion;
  backup?: IBackup;  // Optional - only needed for BACKUP or BOTH strategies
}
```

{: .important }
> **Breaking Changes (v0.3.0):**
> - The `cfg: Config` property has been removed from this interface. Config is now passed separately to service constructors.
> - The `backup` property is now **optional**. Only implement it if using BACKUP or BOTH rollback strategies.
>
> See the [migration guide](../migrations/v0.2-to-v0.3) for details.

#### Properties

##### getName()

Returns the name of the database handler for logging and display purposes.

```typescript
getName(): string
```

**Example:**
```typescript
getName(): string {
  return 'PostgreSQL Handler';
}
```

---

##### db

Database connection and query interface.

```typescript
db: IDB
```

Provides methods for executing queries and managing transactions. See `IDB` interface for details.

---

##### schemaVersion

Schema version tracking interface.

```typescript
schemaVersion: ISchemaVersion
```

Manages the schema version tracking table. See `ISchemaVersion` interface for details.

---

##### backup

Backup and restore interface (optional).

```typescript
backup?: IBackup
```

**Optional:** Only required for BACKUP or BOTH rollback strategies. Can be omitted when using DOWN or NONE strategies.

Handles database backup and restore operations. See `IBackup` interface for details.

---

### IDB

Create a backup of current database state.

```typescript
async backup(): Promise<string>
```

**Returns:** Serialized backup data (typically JSON string)

Called before starting migrations. Should capture enough state to fully restore the database.

---

##### restore()

Restore database from backup data.

```typescript
async restore(data: string): Promise<void>
```

**Parameters:**
- `data`: Serialized backup data (from `backup()`)

Called if any migration fails. Should restore database to the state captured in the backup.

---

### IMigrationResult

Result object returned by migration operations.

```typescript
interface IMigrationResult {
  success: boolean;
  executed: MigrationScript[];
  migrated: MigrationScript[];
  ignored: MigrationScript[];
  errors?: Error[];
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `success` | `boolean` | Whether all migrations completed successfully |
| `executed` | `MigrationScript[]` | Migrations executed during this run |
| `migrated` | `MigrationScript[]` | Previously executed migrations from database |
| `ignored` | `MigrationScript[]` | Migrations older than last executed (skipped) |
| `errors` | `Error[]?` | Array of errors (only present when success is false) |

**Example:**
```typescript
const result: IMigrationResult = await executor.migrate();

console.log('Success:', result.success);
console.log('Executed:', result.executed.length);
console.log('Total migrated:', result.migrated.length);
console.log('Ignored:', result.ignored.length);

if (!result.success) {
  console.error('Errors:', result.errors);
}
```

---

### IMigrationInfo

Metadata about a migration execution.

```typescript
interface IMigrationInfo {
  timestamp: number;       // Migration version (from filename)
  name: string;           // Migration name (from filename)
  executed: number;       // Unix timestamp of execution
  duration: number;       // Execution time in milliseconds
  username: string;       // User who ran the migration
  result: any;           // Result returned by migration
  foundLocally?: boolean; // Whether migration file exists locally
}
```

---

### IRunnableScript

Interface for migration script classes. Used by both regular migrations and the special `beforeMigrate` setup script.

```typescript
interface IRunnableScript {
  up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string>;
  down?(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string>;
}
```

#### Methods

##### up()

Execute the migration (forward).

```typescript
async up(
  db: IDB,
  info: IMigrationInfo,
  handler: IDatabaseMigrationHandler
): Promise<string>
```

**Parameters:**
- `db`: Your database connection/client object (extend `IDB` for type safety)
- `info`: Metadata about this migration
- `handler`: The database handler (for advanced use cases)

**Returns:** String describing the migration result (stored in migration tracking table for regular migrations, not stored for beforeMigrate)

**Example:**
```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

// Define your database type for type safety
interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export default class AddUsersTable implements IRunnableScript {
  async up(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created';
  }
}
```

---

##### down()

Rollback the migration (optional).

```typescript
async down(
  db: IDB,
  info: IMigrationInfo,
  handler: IDatabaseMigrationHandler
): Promise<string>
```

**Optional:** Only required for DOWN or BOTH rollback strategies. Allows migrations to be rolled back without database backups.

**Parameters:**
- `db`: Your database connection/client object (extend `IDB` for type safety)
- `info`: Metadata about this migration
- `handler`: The database handler (for advanced use cases)

**Returns:** String describing the rollback result

**Example:**
```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export default class AddUsersTable implements IRunnableScript {
  async up(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created';
  }

  // Optional: Reverse the changes made in up()
  async down(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    await db.query('DROP TABLE IF EXISTS users');
    return 'Users table dropped';
  }
}
```

{: .warning }
> The `down()` method is called when a migration fails, **including the failed migration itself**. This allows cleanup of partial changes. Ensure your down() method is idempotent and can handle being called on partially-executed migrations.

See [Writing Migrations Guide](../guides/writing-migrations#reversible-migrations) for best practices.

---

**Example (beforeMigrate Setup Script):**
```typescript
// migrations/beforeMigrate.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

export default class BeforeMigrate implements IRunnableScript {
  async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    // This runs BEFORE migration scanning
    // Perfect for loading snapshots, creating extensions, etc.
    console.log('Running beforeMigrate setup...');

    // Your setup logic here

    return 'Setup completed';
  }
}
```

{: .note }
The `beforeMigrate` script uses the same `IRunnableScript` interface but is NOT saved to the schema version table. It executes before MSR scans for pending migrations.

---

## Model Classes

### MigrationScript

Represents a migration script file.

```typescript
class MigrationScript {
  timestamp: number;
  name: string;
  filepath: string;
  script?: IMigrationScript;
  startedAt?: number;
  username?: string;
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `timestamp` | `number` | Migration version number |
| `name` | `string` | Migration filename |
| `filepath` | `string` | Absolute path to migration file |
| `script` | `IMigrationScript?` | Loaded migration instance |
| `startedAt` | `number?` | Execution start timestamp |
| `username` | `string?` | User executing migration |

#### Methods

##### init()

Load and instantiate the migration script.

```typescript
await migrationScript.init(): Promise<void>
```

Dynamically imports the migration file and creates an instance of the exported class.

---

## Utility Classes

### Utils

Internal utility functions (not typically used directly).

```typescript
import { Utils } from '@migration-script-runner/core';
```

#### Methods

##### promiseAll()

Resolve all promises in an object, preserving keys.

```typescript
static async promiseAll<T>(map: { [key: string]: Promise<T> }): Promise<{ [key: string]: T }>
```

Similar to `Promise.all()` but works with objects instead of arrays.

---

##### parseRunnable()

Parse and instantiate a migration script from a file path.

```typescript
static async parseRunnable(filepath: string): Promise<IMigrationScript>
```

**Parameters:**
- `filepath`: Absolute path to migration file

**Returns:** Instance of migration script

**Throws:** Error if file cannot be parsed or doesn't contain valid migration

---

## Services

### MigrationService

Service for scanning and loading migration files.

```typescript
import { MigrationService } from '@migration-script-runner/core';

const service = new MigrationService();
const scripts = await service.readMigrationScripts(config);
```

#### Methods

##### readMigrationScripts()

Scan directory and load all migration scripts.

```typescript
async readMigrationScripts(config: Config): Promise<MigrationScript[]>
```

**Parameters:**
- `config`: Configuration object

**Returns:** Array of `MigrationScript` objects sorted by timestamp

{: .note }
The `beforeMigrate` file (if it exists) is NOT included in the results. It's handled separately via `getBeforeMigrateScript()`.

---

##### getBeforeMigrateScript()

Check if a `beforeMigrate` setup script exists.

```typescript
async getBeforeMigrateScript(config: Config): Promise<string | undefined>
```

**Parameters:**
- `config`: Configuration object containing `beforeMigrateName` property

**Returns:** Path to beforeMigrate script if found, `undefined` otherwise

**Behavior:**
- Returns `undefined` if `config.beforeMigrateName` is `null` (feature disabled)
- Looks for files with configured name + `.ts` or `.js` extension
- Only searches in root of migrations folder (not recursive)

**Example:**
```typescript
const config = new Config();
config.beforeMigrateName = 'beforeMigrate';  // default
config.folder = './migrations';

const service = new MigrationService();
const path = await service.getBeforeMigrateScript(config);

if (path) {
  console.log(`Found beforeMigrate script: ${path}`);
  // migrations/beforeMigrate.ts
}
```

---

### SchemaVersionService

Service for managing the schema version tracking table.

```typescript
import { SchemaVersionService } from '@migration-script-runner/core';

const service = new SchemaVersionService(config, handler);
await service.init();
```

#### Methods

##### init()

Initialize the schema version table.

```typescript
async init(): Promise<void>
```

---

##### save()

Save migration info to tracking table.

```typescript
async save(info: IMigrationInfo): Promise<void>
```

---

##### getAllMigratedScripts()

Get all executed migrations.

```typescript
async getAllMigratedScripts(): Promise<IMigrationInfo[]>
```

---

##### remove()

Remove a migration record from the schema version table.

```typescript
async remove(timestamp: number): Promise<void>
```

**Parameters:**
- `timestamp`: The timestamp of the migration to remove

**Usage:**
Used internally by `downTo()` to remove migration records after successful rollback. Can also be used manually for maintenance operations.

**Example:**
```typescript
const service = new SchemaVersionService(config, handler);
await service.remove(202501220100);
```

{: .note }
> This method is called automatically by `downTo()` after successfully executing a migration's `down()` method. Manual use is typically not needed unless performing database maintenance.

---

### BackupService

Service for backup and restore operations.

```typescript
import { BackupService } from '@migration-script-runner/core';

const service = new BackupService(config.backup, handler);
const backupPath = await service.backup();
```

#### Methods

##### backup()

Create a backup file.

```typescript
async backup(): Promise<string>
```

**Returns:** Path to created backup file

---

##### restore()

Restore from a backup file.

```typescript
async restore(backupPath: string): Promise<void>
```

---

##### deleteBackup()

Delete a backup file.

```typescript
async deleteBackup(backupPath: string): Promise<void>
```

---

## TypeScript Types

All classes and interfaces are fully typed. Import types as needed:

```typescript
import {
  IMigrationScript,
  IMigrationInfo,
  IMigrationResult,
  IDatabaseMigrationHandler,
  Config,
  BackupConfig,
  MigrationScriptExecutor
} from '@migration-script-runner/core';
```

---

## Next Steps

- [Configuration Guide](../configuration) - Detailed configuration options
- [Writing Migrations](../guides/writing-migrations) - Best practices
- [Getting Started](../getting-started) - Quick start guide
