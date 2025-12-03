---
layout: default
title: ISchemaVersion<IDB> & IMigrationScript
parent: Interfaces
grand_parent: API Reference
nav_order: 4
---

# ISchemaVersion & IMigrationScript
{: .no_toc }

Interfaces for schema version tracking and migration records.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## ISchemaVersion

Interface for managing the schema version tracking table.

```typescript
interface ISchemaVersion {
  migrationRecords: IMigrationScript;
  isInitialized(): Promise<boolean>;
  createTable(): Promise<void>;
  validateTable(): Promise<void>;
}
```

> **Breaking Change (v0.4.0):** Property `migrations` renamed to `migrationRecords` for clarity.
{: .important }

**Purpose:** Manages the database table that tracks which migrations have been executed.

---

### Properties

#### migrationRecords

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

See [`IMigrationScript` interface](#imigrationscript) below for methods.

---

### Methods

#### isInitialized()

Check if schema version table exists.

```typescript
async isInitialized(): Promise<boolean>
```

**Returns:** `true` if table exists, `false` otherwise

**Example (PostgreSQL):**
```typescript
async isInitialized(): Promise<boolean> {
  const result = await this.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'schema_version'
    )
  `);
  return result[0].exists;
}
```

---

#### createTable()

Create the schema version table.

```typescript
async createTable(): Promise<void>
```

**Called automatically** on first migration run if table doesn't exist.

**Required Columns:**
- `timestamp` (BIGINT/NUMBER) - Migration version
- `name` (VARCHAR/STRING) - Migration name
- `executed` (BIGINT/NUMBER) - Execution timestamp (Unix)
- `duration` (INT/NUMBER) - Execution duration (ms)
- `username` (VARCHAR/STRING) - User who ran migration
- `result` (TEXT/STRING) - Result message from migration

**Example (PostgreSQL):**
```typescript
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

  // Optional: Add indexes
  await this.db.query(`
    CREATE INDEX IF NOT EXISTS idx_schema_version_executed
    ON schema_version(executed)
  `);
}
```

**Example (MongoDB):**
```typescript
async createTable(): Promise<void> {
  const collection = this.db.getCollection('schema_version');

  // Create unique index on timestamp
  await collection.createIndex(
    { timestamp: 1 },
    { unique: true }
  );

  // Create index on executed timestamp
  await collection.createIndex({ executed: 1 });
}
```

---

#### validateTable()

Validate schema version table structure.

```typescript
async validateTable(): Promise<void>
```

**Throws:** Error if table structure is invalid or incompatible

**Example (PostgreSQL):**
```typescript
async validateTable(): Promise<void> {
  const columns = await this.db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'schema_version'
  `);

  const required = ['timestamp', 'name', 'executed', 'duration', 'username'];
  const existing = columns.map(c => c.column_name);

  for (const col of required) {
    if (!existing.includes(col)) {
      throw new Error(
        `schema_version table is missing required column: ${col}`
      );
    }
  }
}
```

---

### Complete Implementation Example

#### PostgreSQL

```typescript
import { ISchemaVersion, IMigrationScript, ISqlDB } from '@migration-script-runner/core';

export class PostgresSchemaVersion implements ISchemaVersion {
  migrationRecords: IMigrationScript;

  constructor(
    private db: ISqlDB,
    private tableName: string = 'schema_version'
  ) {
    this.migrationRecords = new PostgresMigrationScript(db, tableName);
  }

  async isInitialized(): Promise<boolean> {
    const result = await this.db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = $1
      )
    `, [this.tableName]);

    return result[0].exists;
  }

  async createTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        timestamp BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed BIGINT NOT NULL,
        duration INTEGER NOT NULL,
        username VARCHAR(255) NOT NULL,
        result TEXT
      )
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_executed
      ON ${this.tableName}(executed)
    `);
  }

  async validateTable(): Promise<void> {
    const columns = await this.db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1
    `, [this.tableName]);

    const required = ['timestamp', 'name', 'executed', 'duration', 'username'];
    const existing = columns.map((c: any) => c.column_name);

    for (const col of required) {
      if (!existing.includes(col)) {
        throw new Error(
          `Table ${this.tableName} is missing column: ${col}`
        );
      }
    }
  }
}
```

#### MongoDB

```typescript
import { ISchemaVersion, IMigrationScript, IDB } from '@migration-script-runner/core';

export class MongoSchemaVersion implements ISchemaVersion {
  migrationRecords: IMigrationScript;

  constructor(
    private db: MongoDB,
    private collectionName: string = 'schema_version'
  ) {
    this.migrationRecords = new MongoMigrationScript(db, collectionName);
  }

  async isInitialized(): Promise<boolean> {
    const collections = await this.db
      .getCollection(this.collectionName)
      .find()
      .limit(1)
      .toArray();

    return collections.length > 0;
  }

  async createTable(): Promise<void> {
    const collection = this.db.getCollection(this.collectionName);

    // Create indexes
    await collection.createIndex({ timestamp: 1 }, { unique: true });
    await collection.createIndex({ executed: 1 });
  }

  async validateTable(): Promise<void> {
    const collection = this.db.getCollection(this.collectionName);
    const indexes = await collection.indexes();

    const hasTimestampIndex = indexes.some(idx =>
      idx.key.timestamp === 1 && idx.unique === true
    );

    if (!hasTimestampIndex) {
      throw new Error(
        `Collection ${this.collectionName} missing unique timestamp index`
      );
    }
  }
}
```

---

## IMigrationScript

Interface for accessing migration execution records in the database.

```typescript
interface IMigrationScript {
  getAllExecuted(): Promise<IMigrationInfo[]>;
  save(info: IMigrationInfo): Promise<void>;
  remove(timestamp: number): Promise<void>;
}
```

> **Breaking Change (v0.4.0):** Method `getAll()` renamed to `getAllExecuted()` to clarify it returns executed migrations only.
{: .important }

**Purpose:** Provides database operations for migration tracking records.

---

### Methods

#### getAllExecuted()

Get all executed migrations from the database.

```typescript
async getAllExecuted(): Promise<IMigrationInfo[]>
```

**Returns:** Array of migration records sorted by timestamp (oldest first)

**Before (v0.3.x):**
```typescript
const executed = await handler.schemaVersion.migrations.getAll();
```

**After (v0.4.0):**
```typescript
const executed = await handler.schemaVersion.migrationRecords.getAllExecuted();
```

**Example (PostgreSQL):**
```typescript
async getAllExecuted(): Promise<IMigrationInfo[]> {
  const rows = await this.db.query(`
    SELECT timestamp, name, executed, duration, username, result
    FROM schema_version
    ORDER BY timestamp ASC
  `);

  return rows.map((row: any) => ({
    timestamp: row.timestamp,
    name: row.name,
    executed: row.executed,
    duration: row.duration,
    username: row.username,
    result: row.result,
    foundLocally: false  // Will be set by MSR
  }));
}
```

---

#### save()

Save a migration execution record.

```typescript
async save(info: IMigrationInfo): Promise<void>
```

**Parameters:**
- `info`: Migration execution metadata to save

**Called automatically** after each successful migration execution.

**Example (PostgreSQL):**
```typescript
async save(info: IMigrationInfo): Promise<void> {
  await this.db.query(`
    INSERT INTO schema_version (
      timestamp, name, executed, duration, username, result
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (timestamp) DO UPDATE SET
      executed = EXCLUDED.executed,
      duration = EXCLUDED.duration,
      result = EXCLUDED.result
  `, [
    info.timestamp,
    info.name,
    info.executed,
    info.duration,
    info.username,
    info.result
  ]);
}
```

**Example (MongoDB):**
```typescript
async save(info: IMigrationInfo): Promise<void> {
  await this.db.getCollection('schema_version').updateOne(
    { timestamp: info.timestamp },
    {
      $set: {
        name: info.name,
        executed: info.executed,
        duration: info.duration,
        username: info.username,
        result: info.result
      }
    },
    { upsert: true }
  );
}
```

---

#### remove()

Remove a migration record from the database.

```typescript
async remove(timestamp: number): Promise<void>
```

**Parameters:**
- `timestamp`: Migration timestamp to remove

**Usage:** Called automatically by `down()` method after successful rollback.

**Example (PostgreSQL):**
```typescript
async remove(timestamp: number): Promise<void> {
  await this.db.query(`
    DELETE FROM schema_version
    WHERE timestamp = $1
  `, [timestamp]);
}
```

**Example (MongoDB):**
```typescript
async remove(timestamp: number): Promise<void> {
  await this.db.getCollection('schema_version').deleteOne({
    timestamp: timestamp
  });
}
```

---

### Complete Implementation Example

#### PostgreSQL

```typescript
import { IMigrationScript, IMigrationInfo, ISqlDB } from '@migration-script-runner/core';

export class PostgresMigrationScript implements IMigrationScript {
  constructor(
    private db: ISqlDB,
    private tableName: string = 'schema_version'
  ) {}

  async getAllExecuted(): Promise<IMigrationInfo[]> {
    const rows = await this.db.query(`
      SELECT timestamp, name, executed, duration, username, result
      FROM ${this.tableName}
      ORDER BY timestamp ASC
    `);

    return (rows as any[]).map(row => ({
      timestamp: row.timestamp,
      name: row.name,
      executed: row.executed,
      duration: row.duration,
      username: row.username,
      result: row.result,
      foundLocally: false
    }));
  }

  async save(info: IMigrationInfo): Promise<void> {
    await this.db.query(`
      INSERT INTO ${this.tableName} (
        timestamp, name, executed, duration, username, result
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (timestamp) DO UPDATE SET
        executed = EXCLUDED.executed,
        duration = EXCLUDED.duration,
        username = EXCLUDED.username,
        result = EXCLUDED.result
    `, [
      info.timestamp,
      info.name,
      info.executed,
      info.duration,
      info.username,
      info.result
    ]);
  }

  async remove(timestamp: number): Promise<void> {
    const result = await this.db.query(`
      DELETE FROM ${this.tableName}
      WHERE timestamp = $1
    `, [timestamp]);

    if (result.rowCount === 0) {
      throw new Error(
        `Migration ${timestamp} not found in ${this.tableName}`
      );
    }
  }
}
```

#### MongoDB

```typescript
import { IMigrationScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

export class MongoMigrationScript implements IMigrationScript {
  constructor(
    private db: MongoDB,
    private collectionName: string = 'schema_version'
  ) {}

  async getAllExecuted(): Promise<IMigrationInfo[]> {
    const collection = this.db.getCollection(this.collectionName);
    const docs = await collection
      .find({})
      .sort({ timestamp: 1 })
      .toArray();

    return docs.map(doc => ({
      timestamp: doc.timestamp,
      name: doc.name,
      executed: doc.executed,
      duration: doc.duration,
      username: doc.username,
      result: doc.result,
      foundLocally: false
    }));
  }

  async save(info: IMigrationInfo): Promise<void> {
    const collection = this.db.getCollection(this.collectionName);

    await collection.updateOne(
      { timestamp: info.timestamp },
      {
        $set: {
          name: info.name,
          executed: info.executed,
          duration: info.duration,
          username: info.username,
          result: info.result
        }
      },
      { upsert: true }
    );
  }

  async remove(timestamp: number): Promise<void> {
    const collection = this.db.getCollection(this.collectionName);
    const result = await collection.deleteOne({ timestamp });

    if (result.deletedCount === 0) {
      throw new Error(
        `Migration ${timestamp} not found in ${this.collectionName}`
      );
    }
  }
}
```

---

## Usage

### In Database Handler

```typescript
import { IDatabaseMigrationHandler, ISchemaVersion } from '@migration-script-runner/core';

export class MyHandler implements IDatabaseMigrationHandler<IDB> {
  db: MyDB;
  schemaVersion: ISchemaVersion;

  constructor(db: MyDB) {
    this.db = db;
    this.schemaVersion = new MySchemaVersion(db);
  }

  getName(): string {
    return 'MyDatabase Handler';
  }
}
```

### Accessing Migration Records

```typescript
// Get all executed migrations
const executed = await handler.schemaVersion.migrationRecords.getAllExecuted();

console.log(`Database has ${executed.length} migrations`);
executed.forEach(m => {
  console.log(`- V${m.timestamp}_${m.name} (${m.duration}ms)`);
});

// Get latest migration
const latest = executed[executed.length - 1];
console.log(`Latest: V${latest.timestamp}_${latest.name}`);
```

---
