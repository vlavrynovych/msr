---
layout: default
title: Database Handler
parent: Interfaces
grand_parent: API Reference
nav_order: 1
---

# IDatabaseMigrationHandler
{: .no_toc }

Main interface for database integration.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Interface that must be implemented for your specific database.

{: .note }
> **Design Origin**: The handler pattern emerged from MSR's 2017 Firebase prototype, where an `EntityService` provided clean helper methods like `updateAll(callback)` and `findAllBy(propertyName, value)`. Instead of raw database SDK calls in every migration, this service layer made migrations declarative and maintainable. This pattern proved so valuable it became core to MSR's architecture - allowing you to inject your own services, repositories, and business logic into migrations. Read more in the [origin story](../../about/origin-story).

**Signature (v0.6.0+):**
```typescript
interface IDatabaseMigrationHandler<DB extends IDB> {
  getName(): string;
  getVersion(): string;
  db: DB;  // Your specific database type
  schemaVersion: ISchemaVersion<DB>;
  backup?: IBackup<DB>;  // Optional - only needed for BACKUP or BOTH strategies
  transactionManager?: ITransactionManager<DB>;  // Optional - auto-created if db supports transactions
}
```

{: .important }
> **Breaking Change (v0.6.0):** Generic type parameter `<DB extends IDB>` is now **required** for full type safety. You must explicitly specify the type parameter in your implementations (e.g., `IDatabaseMigrationHandler<IDB>`). See [v0.6.0 migration guide](../../version-migration/v0.5-to-v0.6) for detailed examples.

{: .important }
> **Breaking Changes (v0.3.0):**
> - The `cfg: Config` property has been removed from this interface. Config is now passed separately to service constructors.
> - The `backup` property is now **optional**. Only implement it if using BACKUP or BOTH rollback strategies.
>
> See the [migration guide](../../version-migration/v0.2-to-v0.3) for details.

---

## Properties

### getName()

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

### db

Database connection and query interface.

```typescript
db: IDB
```

Provides methods for executing queries and managing transactions. See [`IDB` interface](db) for details.

**Type Safety:**

Extend `IDB` with your database-specific methods:

```typescript
interface IPostgresDB extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction(callback: (client: IPostgresDB) => Promise<void>): Promise<void>;
}

class PostgresHandler implements IDatabaseMigrationHandler<IDB> {
  db: IPostgresDB;  // Your extended type
  // ...
}
```

---

### schemaVersion

Schema version tracking interface.

```typescript
schemaVersion: ISchemaVersion
```

Manages the schema version tracking table. See [`ISchemaVersion` interface](schema-version) for details.

---

### backup

Backup and restore interface (optional).

```typescript
backup?: IBackup
```

**Optional:** Only required for BACKUP or BOTH rollback strategies. Can be omitted when using DOWN or NONE strategies.

Handles database backup and restore operations. See [`IBackup` interface](backup) for details.

---

## Complete Example

### PostgreSQL Handler

```typescript
import { Pool } from 'pg';
import {
  IDatabaseMigrationHandler,
  ISchemaVersion,
  IBackup,
  ISqlDB
} from '@migration-script-runner/core';

// Database connection with ISqlDB
class PostgresDB implements ISqlDB {
  constructor(private pool: Pool) {}

  async checkConnection(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }

  async query(sql: string): Promise<unknown> {
    const result = await this.pool.query(sql);
    return result.rows;
  }
}

// Schema version tracking
class PostgresSchemaVersion implements ISchemaVersion {
  migrationRecords: IMigrationScript;

  constructor(private db: PostgresDB) {
    this.migrationRecords = new PostgresMigrationScript(db);
  }

  async isInitialized(): Promise<boolean> {
    const result = await this.db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'schema_version'
      )
    `);
    return result[0].exists;
  }

  async createTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        timestamp BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed BIGINT NOT NULL,
        duration INTEGER NOT NULL,
        username VARCHAR(255) NOT NULL,
        result TEXT
      )
    `);
  }

  async validateTable(): Promise<void> {
    // Validate table structure
  }
}

// Backup implementation (optional)
class PostgresBackup implements IBackup {
  constructor(private db: PostgresDB, private config: Config) {}

  async backup(): Promise<string> {
    const timestamp = Date.now();
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(this.config.backup.folder, filename);

    // Use pg_dump to create backup
    await exec(`pg_dump ${dbUrl} > ${filepath}`);

    return filepath;
  }

  async restore(backupData: string): Promise<void> {
    // Use psql to restore backup
    await exec(`psql ${dbUrl} < ${backupData}`);
  }
}

// Complete handler implementation
export class PostgresHandler implements IDatabaseMigrationHandler<IDB> {
  db: PostgresDB;
  schemaVersion: PostgresSchemaVersion;
  backup?: PostgresBackup;

  constructor(pool: Pool, useBackup: boolean = false) {
    this.db = new PostgresDB(pool);
    this.schemaVersion = new PostgresSchemaVersion(this.db);

    if (useBackup) {
      this.backup = new PostgresBackup(this.db, config);
    }
  }

  getName(): string {
    return 'PostgreSQL Handler';
  }
}
```

### MongoDB Handler

```typescript
import { MongoClient } from 'mongodb';
import {
  IDatabaseMigrationHandler,
  ISchemaVersion,
  IDB
} from '@migration-script-runner/core';

class MongoDB implements IDB {
  constructor(private client: MongoClient) {}

  async checkConnection(): Promise<void> {
    try {
      await this.client.db('admin').command({ ping: 1 });
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  getCollection(name: string) {
    return this.client.db().collection(name);
  }
}

class MongoSchemaVersion implements ISchemaVersion {
  migrationRecords: IMigrationScript;

  constructor(private db: MongoDB) {
    this.migrationRecords = new MongoMigrationScript(db);
  }

  async isInitialized(): Promise<boolean> {
    const collections = await this.db.getCollection('schema_version').find().limit(1).toArray();
    return collections.length > 0;
  }

  async createTable(): Promise<void> {
    await this.db.getCollection('schema_version').createIndex({ timestamp: 1 }, { unique: true });
  }

  async validateTable(): Promise<void> {
    // Validate collection structure
  }
}

export class MongoHandler implements IDatabaseMigrationHandler<IDB> {
  db: MongoDB;
  schemaVersion: MongoSchemaVersion;

  constructor(client: MongoClient) {
    this.db = new MongoDB(client);
    this.schemaVersion = new MongoSchemaVersion(this.db);
  }

  getName(): string {
    return 'MongoDB Handler';
  }
}
```

---

## Usage

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { PostgresHandler } from './postgres-handler';
import { Pool } from 'pg';

// Create database connection
const pool = new Pool({
  host: 'localhost',
  database: 'myapp',
  user: 'postgres',
  password: 'password'
});

// Create handler
const handler = new PostgresHandler(pool, true);  // with backup

// Create executor
const config = new Config();
const executor = new MigrationScriptExecutor({ handler , config });

// Run migrations
const result = await executor.up();
```

---
