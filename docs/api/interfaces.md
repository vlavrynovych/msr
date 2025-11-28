---
layout: default
title: Interfaces
parent: API Reference
nav_order: 2
---

# Interfaces
{: .no_toc }

Core interfaces for implementing database handlers and extending MSR.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

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
> See the [migration guide](../version-migration/v0.2-to-v0.3) for details.

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

Base interface for database connections. This is intentionally minimal to support any database system (SQL, NoSQL, etc.).

```typescript
interface IDB {
  [key: string]: unknown;
}
```

**Purpose:** Provides a minimal base that user implementations extend with their database-specific methods.

**Usage:** Define your database type by extending IDB:

```typescript
// PostgreSQL implementation
interface IPostgresDB extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction(callback: (client: IPostgresDB) => Promise<void>): Promise<void>;
}

// MongoDB implementation
interface IMongoDBConnection extends IDB {
  collection(name: string): Collection;
  startSession(): ClientSession;
}

// Simple key-value store
interface IKeyValueDB extends IDB {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
```

The index signature `[key: string]: unknown` allows implementations to add any additional properties while maintaining type safety for the base interface.

**Note:** This interface is passed to migration scripts' `up()` and `down()` methods, enabling database interaction during migrations.

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

### IRollbackService

Service interface for handling rollback operations during migration failures.

```typescript
interface IRollbackService {
  rollback(executedScripts: MigrationScript[], backupPath?: string): Promise<void>;
  shouldCreateBackup(): boolean;
}
```

The `RollbackService` encapsulates all rollback logic and strategies, coordinating with `BackupService` when needed. It can be injected as a custom implementation via the `dependencies` parameter.

#### Methods

##### rollback()

Execute rollback based on the configured rollback strategy.

```typescript
async rollback(
  executedScripts: MigrationScript[],
  backupPath?: string
): Promise<void>
```

**Parameters:**
- `executedScripts`: Array of migration scripts that were attempted (including the failed one)
- `backupPath` (optional): Path to backup file created before migration

**Strategies:**
- **BACKUP** - Restore from backup file
- **DOWN** - Call `down()` methods in reverse order
- **BOTH** - Try DOWN first, fallback to BACKUP if DOWN fails
- **NONE** - No rollback (logs warning)

**Example:**
```typescript
try {
  await runMigrations();
} catch (error) {
  // Automatically rollback using configured strategy
  await rollbackService.rollback(executedScripts, backupPath);
}
```

---

##### shouldCreateBackup()

Determine if backup should be created based on rollback strategy and backup mode.

```typescript
shouldCreateBackup(): boolean
```

**Returns:** `true` if backup should be created, `false` otherwise

Returns `true` only when:
- Handler has backup interface (`handler.backup` exists)
- Rollback strategy is BACKUP or BOTH
- Backup mode is FULL or CREATE_ONLY

**Example:**
```typescript
if (rollbackService.shouldCreateBackup()) {
  const backupPath = await backupService.backup();
}
```

**Custom Implementation Example:**
```typescript
import { IRollbackService, MigrationScript, Config, IBackupService, ILogger } from '@migration-script-runner/core';

class CustomRollbackService implements IRollbackService {
  constructor(
    private backupService: IBackupService,
    private logger: ILogger
  ) {}

  async rollback(executedScripts: MigrationScript[], backupPath?: string): Promise<void> {
    this.logger.info('Custom rollback logic');
    // Custom rollback implementation
    await this.backupService.restore(backupPath);
  }

  shouldCreateBackup(): boolean {
    // Custom logic to determine if backup should be created
    return true;
  }
}

// Inject custom rollback service
const executor = new MigrationScriptExecutor(handler, config, {
  rollbackService: new CustomRollbackService(backupService, logger)
});
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

See [Writing Migrations Guide](../user-guides/writing-migrations#reversible-migrations) for best practices.

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

