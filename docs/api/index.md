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
import { MigrationScriptExecutor, IDatabaseMigrationHandler } from 'migration-script-runner';

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler);
```

#### Constructor

```typescript
constructor(handler: IDatabaseMigrationHandler)
```

**Parameters:**
- `handler`: Database migration handler (which contains the config via `handler.cfg`)

#### Methods

##### migrate()

Execute all pending migrations.

```typescript
await executor.migrate(): Promise<void>
```

**Returns:** Promise that resolves when all migrations complete

**Throws:** Error if any migration fails (database will be restored from backup)

**Example:**
```typescript
try {
  await executor.migrate();
  console.log('Migrations completed successfully');
} catch (error) {
  console.error('Migration failed:', error);
  // Database has been automatically restored from backup
}
```

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

## Configuration Classes

### Config

Main configuration class.

```typescript
import { Config } from 'migration-script-runner';

const config = new Config();
```

#### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `folder` | `string` | `./migrations` | Migration scripts directory |
| `filePattern` | `RegExp` | `/^V(\d+)_(.+)\.ts$/` | Filename pattern for migrations |
| `tableName` | `string` | `schema_version` | Database table for tracking migrations |
| `displayLimit` | `number` | `0` | Max migrations to display (0 = all) |
| `backup` | `BackupConfig` | `new BackupConfig()` | Backup configuration |

See [Configuration Guide](../configuration) for detailed examples.

---

### BackupConfig

Backup system configuration.

```typescript
import { BackupConfig } from 'migration-script-runner';

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

## Interfaces

### IDatabaseMigrationHandler

Interface that must be implemented for your specific database.

```typescript
interface IDatabaseMigrationHandler {
  init(): Promise<void>;
  save(info: IMigrationInfo): Promise<void>;
  getAllMigratedScripts(): Promise<IMigrationInfo[]>;
  backup(): Promise<string>;
  restore(data: string): Promise<void>;
}
```

#### Methods

##### init()

Initialize database connection and schema version table.

```typescript
async init(): Promise<void>
```

Called once before migrations start. Should:
- Establish database connection
- Create schema version tracking table if it doesn't exist
- Validate table structure

---

##### save()

Save migration execution metadata.

```typescript
async save(info: IMigrationInfo): Promise<void>
```

**Parameters:**
- `info`: Migration metadata object

Called after each successful migration. Should store:
- Migration timestamp and name
- Execution time and duration
- Username and result

---

##### getAllMigratedScripts()

Retrieve all previously executed migrations.

```typescript
async getAllMigratedScripts(): Promise<IMigrationInfo[]>
```

**Returns:** Array of migration metadata for all executed migrations

---

##### backup()

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

### IMigrationScript

Interface for migration script classes.

```typescript
interface IMigrationScript {
  up(db: any, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<any>;
}
```

#### Methods

##### up()

Execute the migration.

```typescript
async up(
  db: any,
  info: IMigrationInfo,
  handler: IDatabaseMigrationHandler
): Promise<any>
```

**Parameters:**
- `db`: Your database connection/client object
- `info`: Metadata about this migration
- `handler`: The database handler (for advanced use cases)

**Returns:** Any value (stored in migration tracking table)

**Example:**
```typescript
export default class AddUsersTable implements IMigrationScript {
  async up(db: any, info: IMigrationInfo): Promise<any> {
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created';
  }
}
```

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
import { Utils } from 'migration-script-runner';
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
import { MigrationService } from 'migration-script-runner';

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

---

### SchemaVersionService

Service for managing the schema version tracking table.

```typescript
import { SchemaVersionService } from 'migration-script-runner';

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

### BackupService

Service for backup and restore operations.

```typescript
import { BackupService } from 'migration-script-runner';

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
  IDatabaseMigrationHandler,
  Config,
  BackupConfig
} from 'migration-script-runner';
```

---

## Next Steps

- [Configuration Guide](../configuration) - Detailed configuration options
- [Writing Migrations](../guides/writing-migrations) - Best practices
- [Getting Started](../getting-started) - Quick start guide
