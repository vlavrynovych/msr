---
layout: default
title: Interfaces (Legacy)
parent: API Reference
nav_order: 2
---

# Interfaces
{: .no_toc }

{: .warning }
> **This page has been split into separate files for better organization.**
>
> **New location:** [Interfaces Overview](interfaces/)

---

## Quick Navigation

The interface documentation has been reorganized into focused pages:

### Core Database Integration
- **[IDatabaseMigrationHandler](interfaces/database-handler)** - Main handler interface
- **[IDB & ISqlDB](interfaces/db)** - Database connection interfaces
- **[ISchemaVersion & IMigrationScript](interfaces/schema-version)** - Migration tracking

### Migration Scripts
- **[IRunnableScript](interfaces/runnable-script)** - Migration script interface

### New in v0.4.0
- **[IMigrationScriptLoader & ILoaderRegistry](interfaces/loaders)** - File loaders
- **[IMigrationResult](interfaces/migration-result)** - Operation results
- **[IBackup](interfaces/backup)** - Backup operations

### See Complete List
Visit the **[Interfaces Overview](interfaces/)** for the complete interface documentation.

---

## Legacy Content Below

{: .note }
This content is preserved for reference but may be outdated. Please use the new organized structure above.

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
  checkConnection(): Promise<void>;
  [key: string]: unknown;
}
```

**Required Methods:**

##### checkConnection()

Validate that the database connection is active and healthy.

```typescript
async checkConnection(): Promise<void>
```

**Called automatically before:**
- Migration execution (`up()`, `down()`)
- Validation operations
- Any database operations

**Example implementations:**

```typescript
// PostgreSQL
class PostgresDB implements IDB {
  async checkConnection(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }
}

// MongoDB
class MongoDB implements IDB {
  async checkConnection(): Promise<void> {
    try {
      await this.client.db('admin').command({ ping: 1 });
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }
}

// MySQL
class MySQLDB implements IDB {
  async checkConnection(): Promise<void> {
    try {
      await this.connection.ping();
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error.message}`);
    }
  }
}
```

{: .important }
> **Breaking Change (v0.4.0):** The `checkConnection()` method is now **required** for all IDB implementations. This enables early detection of connection issues before migration execution.

---

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

### ISqlDB

Extended interface for SQL databases that support raw SQL query execution. Required for SQL migration files (`.up.sql` / `.down.sql`).

```typescript
interface ISqlDB extends IDB {
  query(sql: string): Promise<unknown>;
}
```

**Purpose:** Provides a standardized contract for executing SQL strings, enabling MSR to run SQL migration files.

**Methods:**

##### query()

Execute a raw SQL string and return results.

```typescript
async query(sql: string): Promise<unknown>
```

**Parameters:**
- `sql`: Raw SQL string to execute (may contain multiple statements depending on database)

**Returns:** Query results in database-specific format

**Implementation Examples:**

```typescript
// PostgreSQL with pg library
import { Pool } from 'pg';
import { ISqlDB } from '@migration-script-runner/core';

class PostgresDB implements ISqlDB {
  constructor(private pool: Pool) {}

  async query(sql: string): Promise<unknown> {
    const result = await this.pool.query(sql);
    return result.rows;
  }

  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }
}

// MySQL with mysql2
import { Connection } from 'mysql2/promise';
import { ISqlDB } from '@migration-script-runner/core';

class MySQLDB implements ISqlDB {
  constructor(private connection: Connection) {}

  async query(sql: string): Promise<unknown> {
    const [rows] = await this.connection.execute(sql);
    return rows;
  }

  async checkConnection(): Promise<void> {
    await this.connection.ping();
  }
}

// SQLite with better-sqlite3
import Database from 'better-sqlite3';
import { ISqlDB } from '@migration-script-runner/core';

class SQLiteDB implements ISqlDB {
  constructor(private db: Database.Database) {}

  async query(sql: string): Promise<unknown> {
    try {
      const stmt = this.db.prepare(sql);
      return sql.trim().toUpperCase().startsWith('SELECT')
        ? stmt.all()
        : stmt.run();
    } catch (error) {
      throw new Error(`SQLite query failed: ${error.message}`);
    }
  }

  async checkConnection(): Promise<void> {
    // SQLite file-based, connection always available
    this.db.prepare('SELECT 1').get();
  }
}
```

**Type Guard:**

MSR provides a helper to check if a database implements ISqlDB:

```typescript
import { isSqlDB } from '@migration-script-runner/core';

if (isSqlDB(db)) {
  // TypeScript knows db has query() method
  await db.query('SELECT * FROM users');
}
```

{: .note }
> **New in v0.4.0:** The `ISqlDB` interface was added to support SQL migration files. If your database handler doesn't implement ISqlDB, SQL migrations (`.up.sql` / `.down.sql`) will fail with a clear error message.

**Related:** See [SQL Migrations Guide](../user-guides/sql-migrations) for complete documentation.

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

### IMigrationScriptLoader

Interface for implementing custom file loaders. Part of the loader architecture introduced in v0.4.0.

```typescript
interface IMigrationScriptLoader {
  canHandle(filePath: string): boolean;
  load(script: MigrationScript): Promise<IRunnableScript>;
  getName(): string;
}
```

**Purpose:** Enables MSR to support multiple file types (TypeScript, SQL, JavaScript, etc.) through a pluggable loader system.

**Methods:**

##### canHandle()

Determine if this loader can handle a specific file.

```typescript
canHandle(filePath: string): boolean
```

**Parameters:**
- `filePath`: Absolute path to migration file

**Returns:** `true` if this loader handles the file type, `false` otherwise

**Example:**
```typescript
class TypeScriptLoader implements IMigrationScriptLoader {
  canHandle(filePath: string): boolean {
    return filePath.endsWith('.ts') || filePath.endsWith('.js');
  }
}

class SqlLoader implements IMigrationScriptLoader {
  canHandle(filePath: string): boolean {
    return filePath.endsWith('.up.sql');
  }
}
```

---

##### load()

Load the migration file and return an executable script.

```typescript
async load(script: MigrationScript): Promise<IRunnableScript>
```

**Parameters:**
- `script`: MigrationScript object containing file path and metadata

**Returns:** Executable script implementing `IRunnableScript` interface

**Example:**
```typescript
class TypeScriptLoader implements IMigrationScriptLoader {
  async load(script: MigrationScript): Promise<IRunnableScript> {
    const module = await import(script.path);
    const ScriptClass = module.default;
    return new ScriptClass();
  }

  canHandle(filePath: string): boolean {
    return filePath.endsWith('.ts');
  }

  getName(): string {
    return 'TypeScriptLoader';
  }
}
```

---

##### getName()

Get loader name for debugging and logging.

```typescript
getName(): string
```

**Returns:** Human-readable loader name

**Example:**
```typescript
getName(): string {
  return 'TypeScriptLoader';
}
```

{: .note }
> **New in v0.4.0:** The loader architecture enables extensibility. Built-in loaders: `TypeScriptLoader`, `SqlLoader`.

**Related:** See [Custom Loaders Guide](../customization/custom-loaders) for creating your own loaders.

---

### ILoaderRegistry

Interface for managing migration file loaders.

```typescript
interface ILoaderRegistry {
  register(loader: IMigrationScriptLoader): void;
  findLoader(filePath: string): IMigrationScriptLoader;
  getLoaders(): IMigrationScriptLoader[];
}
```

**Purpose:** Central registry for all file loaders. First registered loader that can handle a file wins.

**Methods:**

##### register()

Register a new loader.

```typescript
register(loader: IMigrationScriptLoader): void
```

**Parameters:**
- `loader`: Loader implementation to register

**Behavior:**
- Loaders are checked in registration order
- First loader where `canHandle()` returns `true` handles the file

**Example:**
```typescript
import { LoaderRegistry, TypeScriptLoader, SqlLoader } from '@migration-script-runner/core';

const registry = new LoaderRegistry();
registry.register(new TypeScriptLoader());
registry.register(new SqlLoader());
registry.register(new CustomPythonLoader());
```

---

##### findLoader()

Find the appropriate loader for a file.

```typescript
findLoader(filePath: string): IMigrationScriptLoader
```

**Parameters:**
- `filePath`: Absolute path to migration file

**Returns:** First loader that can handle the file

**Throws:** Error if no loader can handle the file

**Example:**
```typescript
const loader = registry.findLoader('/migrations/V001_create.ts');
// Returns: TypeScriptLoader

const loader = registry.findLoader('/migrations/V002_add.up.sql');
// Returns: SqlLoader
```

---

##### getLoaders()

Get all registered loaders.

```typescript
getLoaders(): IMigrationScriptLoader[]
```

**Returns:** Array of all registered loaders in registration order

**Example:**
```typescript
const loaders = registry.getLoaders();
console.log(loaders.map(l => l.getName()));
// ['TypeScriptLoader', 'SqlLoader', 'CustomLoader']
```

**Default Registry:**

MSR provides a pre-configured registry:

```typescript
import { LoaderRegistry } from '@migration-script-runner/core';

const registry = LoaderRegistry.createDefault();
// Includes: TypeScriptLoader, SqlLoader
```

{: .note }
> **New in v0.4.0:** The loader registry enables MSR to support multiple file types simultaneously.

---

### ISchemaVersion

Interface for managing the schema version tracking table.

```typescript
interface ISchemaVersion {
  migrationRecords: IMigrationScript;
  isInitialized(): Promise<boolean>;
  createTable(): Promise<void>;
  validateTable(): Promise<void>;
}
```

{: .important }
> **Breaking Change (v0.4.0):** Property `migrations` renamed to `migrationRecords` for clarity.

**Properties:**

##### migrationRecords

Interface for accessing migration execution records.

```typescript
migrationRecords: IMigrationScript
```

Provides CRUD operations for the migration records stored in the schema version table.

**Before (v0.3.x):**
```typescript
await schemaVersion.migrations.getAll();
```

**After (v0.4.0):**
```typescript
await schemaVersion.migrationRecords.getAllExecuted();
```

**Methods:** See `IMigrationScript` interface below.

---

##### isInitialized()

Check if schema version table exists.

```typescript
async isInitialized(): Promise<boolean>
```

**Returns:** `true` if table exists, `false` otherwise

---

##### createTable()

Create the schema version table.

```typescript
async createTable(): Promise<void>
```

**Called automatically** on first migration run if table doesn't exist.

---

##### validateTable()

Validate schema version table structure.

```typescript
async validateTable(): Promise<void>
```

**Throws:** Error if table structure is invalid or incompatible

---

### IMigrationScript

Interface for accessing migration execution records in the database.

```typescript
interface IMigrationScript {
  getAllExecuted(): Promise<IMigrationInfo[]>;
  save(info: IMigrationInfo): Promise<void>;
  remove(timestamp: number): Promise<void>;
}
```

{: .important }
> **Breaking Change (v0.4.0):** Method `getAll()` renamed to `getAllExecuted()` to clarify it returns executed migrations only.

**Methods:**

##### getAllExecuted()

Get all executed migrations from the database.

```typescript
async getAllExecuted(): Promise<IMigrationInfo[]>
```

**Returns:** Array of migration records sorted by timestamp

**Before (v0.3.x):**
```typescript
const executed = await handler.schemaVersion.migrations.getAll();
```

**After (v0.4.0):**
```typescript
const executed = await handler.schemaVersion.migrationRecords.getAllExecuted();
```

---

##### save()

Save a migration execution record.

```typescript
async save(info: IMigrationInfo): Promise<void>
```

**Parameters:**
- `info`: Migration execution metadata to save

---

##### remove()

Remove a migration record from the database.

```typescript
async remove(timestamp: number): Promise<void>
```

**Parameters:**
- `timestamp`: Migration timestamp to remove

**Usage:** Called automatically by `down()` method after successful rollback.

---

### IBackup

Interface for database backup and restore operations.

```typescript
interface IBackup {
  backup(): Promise<string>;
  restore(backupData: string): Promise<void>;
}
```

{: .important }
> **Breaking Change (v0.4.0):** Parameter `data` renamed to `backupData` in `restore()` method for clarity.

**Methods:**

##### backup()

Create a database backup.

```typescript
async backup(): Promise<string>
```

**Returns:** Backup identifier (file path, S3 key, backup ID, etc.)

---

##### restore()

Restore database from backup.

```typescript
async restore(backupData: string): Promise<void>
```

**Parameters:**
- `backupData`: Backup identifier returned by `backup()`
  - File-based: File path to backup file
  - Cloud-based: S3 key, GCS object name, etc.
  - Database-based: Backup ID or snapshot name

**Before (v0.3.x):**
```typescript
async restore(data: string): Promise<void> {
  await this.loadBackup(data);
}
```

**After (v0.4.0):**
```typescript
async restore(backupData: string): Promise<void> {
  await this.loadBackup(backupData);
}
```

---

### IMigrationService

Interface for discovering and loading migration files.

```typescript
interface IMigrationService {
  findMigrationScripts(config: Config): Promise<MigrationScript[]>;
  findBeforeMigrateScript(config: Config): Promise<string | undefined>;
}
```

{: .important }
> **Breaking Change (v0.4.0):**
> - `readMigrationScripts()` → `findMigrationScripts()`
> - `getBeforeMigrateScript()` → `findBeforeMigrateScript()`

**Methods:**

##### findMigrationScripts()

Discover all migration files in the configured folder.

```typescript
async findMigrationScripts(config: Config): Promise<MigrationScript[]>
```

**Parameters:**
- `config`: Configuration containing folder and filePatterns

**Returns:** Array of migration scripts sorted by timestamp

**Before (v0.3.x):**
```typescript
const scripts = await migrationService.readMigrationScripts(config);
```

**After (v0.4.0):**
```typescript
const scripts = await migrationService.findMigrationScripts(config);
```

---

##### findBeforeMigrateScript()

Check if a beforeMigrate setup script exists.

```typescript
async findBeforeMigrateScript(config: Config): Promise<string | undefined>
```

**Parameters:**
- `config`: Configuration containing beforeMigrateName

**Returns:** Path to beforeMigrate script if found, `undefined` otherwise

**Before (v0.3.x):**
```typescript
const path = await migrationService.getBeforeMigrateScript(config);
```

**After (v0.4.0):**
```typescript
const path = await migrationService.findBeforeMigrateScript(config);
```

---

