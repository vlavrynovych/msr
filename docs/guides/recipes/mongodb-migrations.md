---
layout: default
title: MongoDB Migrations
parent: Recipes
grand_parent: Guides
nav_order: 2
---

# MongoDB Migrations
{: .no_toc }

Complete MongoDB database handler implementation for NoSQL migrations with schema version tracking.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## What You'll Learn

- Implementing `IDatabaseMigrationHandler` for MongoDB
- Schema version tracking in NoSQL databases
- Handling schemaless data transformations
- Backup strategies for MongoDB
- Index management and migrations
- Testing MongoDB migrations

---

## Overview

This recipe provides a production-ready MongoDB handler with:
- Full `IDatabaseMigrationHandler` implementation
- JSON-based backup/restore
- Schema version tracking in MongoDB collection
- Type-safe operations with MongoDB driver
- Index creation and management

**When to use:**
- MongoDB database migrations
- NoSQL schema evolution
- Collection and index management
- Data transformations in document databases

---

## Prerequisites

```bash
npm install mongodb
npm install --save-dev @types/mongodb
```

---

## Complete Implementation

### MongoDB Handler

```typescript
// src/database/MongoDBHandler.ts
import { MongoClient, Db, Collection } from 'mongodb';
import {
  IDatabaseMigrationHandler,
  IDB,
  IBackup,
  ISchemaVersion,
  IMigrationScript
} from '@migration-script-runner/core';

/**
 * MongoDB-specific database interface
 */
export interface IMongoDBDatabase extends IDB {
  client: MongoClient;
  db: Db;
  collection<T = any>(name: string): Collection<T>;
}

/**
 * Configuration for MongoDB connection
 */
export interface IMongoDBConfig {
  url: string;
  database: string;
  options?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    serverSelectionTimeoutMS?: number;
  };
}

/**
 * Complete MongoDB handler with backup/restore capability
 */
export class MongoDBHandler implements IDatabaseMigrationHandler<IDB> {
  readonly db: IMongoDBDatabase;
  readonly backup: IBackup;
  readonly schemaVersion: ISchemaVersion;

  private readonly config: IMongoDBConfig;
  private readonly schemaVersionCollection = 'schema_version';

  constructor(config: IMongoDBConfig) {
    this.config = config;

    // Initialize MongoDB client
    const client = new MongoClient(config.url, {
      maxPoolSize: config.options?.maxPoolSize || 10,
      minPoolSize: config.options?.minPoolSize || 2,
      serverSelectionTimeoutMS: config.options?.serverSelectionTimeoutMS || 5000
    });

    // Setup database interface
    this.db = {
      client,
      db: client.db(config.database),
      collection: <T = any>(name: string): Collection<T> => {
        return client.db(config.database).collection<T>(name);
      }
    };

    // Setup backup implementation
    this.backup = {
      backup: this.createBackup.bind(this),
      restore: this.restoreBackup.bind(this)
    };

    // Setup schema version tracking
    this.schemaVersion = {
      init: this.initSchemaVersionCollection.bind(this),
      list: this.listMigratedScripts.bind(this),
      add: this.addMigratedScript.bind(this),
      remove: this.removeMigratedScript.bind(this)
    };
  }

  /**
   * Returns handler name for logging
   */
  getName(): string {
    return `MongoDB Handler (${this.config.database})`;
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    await this.db.client.connect();
  }

  /**
   * Close MongoDB connection
   */
  async close(): Promise<void> {
    await this.db.client.close();
  }

  // ========================================
  // BACKUP IMPLEMENTATION
  // ========================================

  /**
   * Create database backup by exporting all collections as JSON
   */
  private async createBackup(): Promise<string> {
    try {
      const collections = await this.db.db.listCollections().toArray();
      const backup: Record<string, any[]> = {};

      // Export each collection
      for (const collectionInfo of collections) {
        const collectionName = collectionInfo.name;

        // Skip system collections and schema_version
        if (collectionName.startsWith('system.') || collectionName === this.schemaVersionCollection) {
          continue;
        }

        const collection = this.db.collection(collectionName);
        const documents = await collection.find({}).toArray();

        backup[collectionName] = documents;
      }

      const backupData = {
        timestamp: Date.now(),
        database: this.config.database,
        collections: backup
      };

      return JSON.stringify(backupData);
    } catch (error) {
      throw new Error(`Backup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Restore database from backup
   */
  private async restoreBackup(backupData: string): Promise<void> {
    try {
      const backup = JSON.parse(backupData);

      if (!backup.collections) {
        throw new Error('Invalid backup format');
      }

      console.log(`Restoring backup from ${new Date(backup.timestamp).toISOString()}...`);

      // Drop all collections except schema_version
      const existingCollections = await this.db.db.listCollections().toArray();
      for (const collectionInfo of existingCollections) {
        if (
          !collectionInfo.name.startsWith('system.') &&
          collectionInfo.name !== this.schemaVersionCollection
        ) {
          await this.db.collection(collectionInfo.name).drop();
        }
      }

      // Restore collections
      for (const [collectionName, documents] of Object.entries(backup.collections)) {
        if (Array.isArray(documents) && documents.length > 0) {
          const collection = this.db.collection(collectionName);
          await collection.insertMany(documents as any[]);
        }
      }

      console.log('✅ Backup restored successfully');
    } catch (error) {
      throw new Error(`Restore failed: ${(error as Error).message}`);
    }
  }

  // ========================================
  // SCHEMA VERSION IMPLEMENTATION
  // ========================================

  /**
   * Initialize schema version tracking collection
   */
  private async initSchemaVersionCollection(): Promise<void> {
    // MongoDB automatically creates collections on first insert
    // Create index for faster queries
    const collection = this.db.collection(this.schemaVersionCollection);

    await collection.createIndex({ timestamp: 1 }, { unique: true });
  }

  /**
   * List all migrated scripts
   */
  private async listMigratedScripts(): Promise<IMigrationScript[]> {
    const collection = this.db.collection<IMigrationScript>(this.schemaVersionCollection);

    const scripts = await collection
      .find({})
      .sort({ timestamp: 1 })
      .toArray();

    // Remove MongoDB's _id field
    return scripts.map(({ _id, ...script }: any) => script);
  }

  /**
   * Add migrated script to tracking collection
   */
  private async addMigratedScript(script: IMigrationScript): Promise<void> {
    const collection = this.db.collection(this.schemaVersionCollection);

    await collection.insertOne({
      timestamp: script.timestamp,
      name: script.name,
      checksum: script.checksum,
      executed_at: new Date()
    });
  }

  /**
   * Remove migrated script from tracking collection
   */
  private async removeMigratedScript(timestamp: number): Promise<void> {
    const collection = this.db.collection(this.schemaVersionCollection);

    await collection.deleteOne({ timestamp });
  }
}
```

---

## Usage Example

### Basic Setup

```typescript
// src/migrate.ts
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { MongoDBHandler } from './database/MongoDBHandler';

async function runMigrations() {
  // Configure MongoDB connection
  const handler = new MongoDBHandler({
    url: process.env.MONGO_URL || 'mongodb://localhost:27017',
    database: process.env.MONGO_DB || 'myapp',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    }
  });

  // Connect to MongoDB
  await handler.connect();

  // Configure MSR
  const config = new Config();
  config.folder = './migrations';
  config.backup.folder = './backups';

  // Create executor
  const executor = new MigrationScriptExecutor(handler, config);

  try {
    console.log('Running migrations...');
    const result = await executor.up();

    if (result.success) {
      console.log(`✅ Success! Executed ${result.executed.length} migrations`);
    } else {
      console.error('❌ Migration failed:', result.errors);
      process.exit(1);
    }
  } finally {
    await handler.close();
  }
}

runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

## Writing MongoDB Migrations

### Creating Collections

```typescript
// migrations/V202501220100_create_users_collection.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler } from '@migration-script-runner/core';
import { IMongoDBDatabase } from '../src/database/MongoDBHandler';

export default class CreateUsersCollection implements IRunnableScript<IDB> {
  async up(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    // Create collection with validation
    await db.db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['email', 'name', 'createdAt'],
          properties: {
            email: {
              bsonType: 'string',
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
              description: 'Must be a valid email address'
            },
            name: {
              bsonType: 'string',
              minLength: 1,
              description: 'Must be a non-empty string'
            },
            age: {
              bsonType: 'int',
              minimum: 0,
              maximum: 150,
              description: 'Must be an integer between 0 and 150'
            },
            createdAt: {
              bsonType: 'date',
              description: 'Must be a date'
            }
          }
        }
      }
    });

    // Create indexes
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ createdAt: -1 });

    return 'Users collection created with validation and indexes';
  }

  async down(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    await db.collection('users').drop();
    return 'Users collection dropped';
  }
}
```

### Creating Indexes

```typescript
// migrations/V202501220101_add_name_text_index.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler } from '@migration-script-runner/core';
import { IMongoDBDatabase } from '../src/database/MongoDBHandler';

export default class AddNameTextIndex implements IRunnableScript<IDB> {
  async up(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    const users = db.collection('users');

    // Create text index for full-text search
    await users.createIndex(
      { name: 'text', bio: 'text' },
      { name: 'text_search_index' }
    );

    return 'Text search index created on name and bio fields';
  }

  async down(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    const users = db.collection('users');
    await users.dropIndex('text_search_index');
    return 'Text search index dropped';
  }
}
```

### Data Transformations

```typescript
// migrations/V202501220102_normalize_email_addresses.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler } from '@migration-script-runner/core';
import { IMongoDBDatabase } from '../src/database/MongoDBHandler';

export default class NormalizeEmailAddresses implements IRunnableScript<IDB> {
  async up(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    const users = db.collection('users');

    // Store original emails for rollback
    const emailBackup = db.collection('_email_backup_' + info.timestamp);
    const originalUsers = await users.find({}).toArray();
    if (originalUsers.length > 0) {
      await emailBackup.insertMany(
        originalUsers.map(u => ({ _id: u._id, email: u.email }))
      );
    }

    // Normalize emails to lowercase
    const result = await users.updateMany(
      {},
      [{ $set: { email: { $toLower: '$email' } } }]
    );

    return `Normalized ${result.modifiedCount} email addresses to lowercase`;
  }

  async down(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    const users = db.collection('users');
    const emailBackup = db.collection('_email_backup_' + info.timestamp);

    // Restore original emails
    const backupData = await emailBackup.find({}).toArray();

    let restored = 0;
    for (const backup of backupData) {
      await users.updateOne(
        { _id: backup._id },
        { $set: { email: backup.email } }
      );
      restored++;
    }

    // Clean up backup collection
    await emailBackup.drop();

    return `Restored ${restored} original email addresses`;
  }
}
```

### Adding Fields

```typescript
// migrations/V202501220103_add_preferences_field.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler } from '@migration-script-runner/core';
import { IMongoDBDatabase } from '../src/database/MongoDBHandler';

export default class AddPreferencesField implements IRunnableScript<IDB> {
  async up(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    const users = db.collection('users');

    const result = await users.updateMany(
      { preferences: { $exists: false } },
      {
        $set: {
          preferences: {
            theme: 'light',
            notifications: true,
            language: 'en'
          }
        }
      }
    );

    return `Added preferences field to ${result.modifiedCount} users`;
  }

  async down(
    db: IMongoDBDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    const users = db.collection('users');

    const result = await users.updateMany(
      {},
      { $unset: { preferences: '' } }
    );

    return `Removed preferences field from ${result.modifiedCount} users`;
  }
}
```

---

## Testing

### Integration Tests

```typescript
// test/integration/mongodb-migrations.test.ts
import { expect } from 'chai';
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { MongoDBHandler } from '../../src/database/MongoDBHandler';

describe('MongoDB Migration Integration', () => {
  let handler: MongoDBHandler;
  let executor: MigrationScriptExecutor;

  before(async () => {
    handler = new MongoDBHandler({
      url: 'mongodb://localhost:27017',
      database: 'test_migrations'
    });

    await handler.connect();

    const config = new Config();
    config.folder = './migrations';

    executor = new MigrationScriptExecutor(handler, config);
  });

  after(async () => {
    await handler.close();
  });

  beforeEach(async () => {
    // Clean database
    const collections = await handler.db.db.listCollections().toArray();
    for (const col of collections) {
      if (!col.name.startsWith('system.')) {
        await handler.db.collection(col.name).drop();
      }
    }
  });

  it('should execute all migrations', async () => {
    const result = await executor.up();

    expect(result.success).to.be.true;
    expect(result.executed.length).to.be.greaterThan(0);
  });

  it('should create collections with validation', async () => {
    await executor.up();

    const collections = await handler.db.db.listCollections({ name: 'users' }).toArray();
    expect(collections).to.have.lengthOf(1);

    // Verify validation schema exists
    const collectionInfo = collections[0];
    expect(collectionInfo.options?.validator).to.exist;
  });

  it('should create indexes', async () => {
    await executor.up();

    const users = handler.db.collection('users');
    const indexes = await users.indexes();

    expect(indexes.some(idx => idx.name === 'email_1')).to.be.true;
  });

  it('should rollback using down methods', async () => {
    await executor.up();
    await executor.downTo(0);

    const collections = await handler.db.db.listCollections().toArray();
    const nonSystemCollections = collections.filter(c => !c.name.startsWith('system.'));

    expect(nonSystemCollections).to.have.lengthOf(1); // Only schema_version
  });
});
```

---

## Best Practices

<details markdown="1">
<summary>Advanced: MongoDB-specific best practices</summary>

### 1. Use Schema Validation

MongoDB 3.6+ supports JSON Schema validation:

```typescript
await db.db.createCollection('orders', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'total', 'status'],
      properties: {
        userId: { bsonType: 'objectId' },
        total: { bsonType: 'double', minimum: 0 },
        status: { enum: ['pending', 'completed', 'cancelled'] }
      }
    }
  }
});
```

### 2. Handle Large Collections

For large collections, use batch processing:

```typescript
async up(db: IMongoDBDatabase): Promise<string> {
  const users = db.collection('users');
  const batchSize = 1000;
  let processed = 0;

  const cursor = users.find({});

  while (await cursor.hasNext()) {
    const batch = [];
    for (let i = 0; i < batchSize && await cursor.hasNext(); i++) {
      batch.push(await cursor.next());
    }

    // Process batch
    const operations = batch.map(user => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { migrated: true } }
      }
    }));

    await users.bulkWrite(operations);
    processed += batch.length;

    console.log(`Processed ${processed} documents...`);
  }

  return `Migrated ${processed} documents`;
}
```

### 3. Preserve Data for Rollback

Create temporary backup collections:

```typescript
// In up()
const backupCollection = db.collection('_backup_' + info.timestamp);
const original = await collection.find({}).toArray();
if (original.length > 0) {
  await backupCollection.insertMany(original);
}

// In down()
const backupCollection = db.collection('_backup_' + info.timestamp);
// Restore data
await backupCollection.drop(); // Clean up
```

</details>

---

## Common Issues

### Issue 1: Connection Timeout

**Error:** `MongoServerSelectionError: connection timed out`

**Solution:**
```typescript
const handler = new MongoDBHandler({
  url: 'mongodb://localhost:27017',
  database: 'myapp',
  options: {
    serverSelectionTimeoutMS: 10000 // Increase timeout
  }
});
```

### Issue 2: Duplicate Key Error

**Error:** `E11000 duplicate key error`

**Solution:** Handle existing data or use `updateOne` with `upsert`:

```typescript
await users.updateOne(
  { email: 'user@example.com' },
  { $set: { name: 'User' } },
  { upsert: true }
);
```

### Issue 3: Schema Validation Failed

**Error:** `Document failed validation`

**Solution:** Either fix the data or temporarily disable validation:

```typescript
// Disable validation
await db.db.command({
  collMod: 'users',
  validator: {},
  validationLevel: 'off'
});

// Run migration

// Re-enable validation
await db.db.command({
  collMod: 'users',
  validator: originalValidator,
  validationLevel: 'strict'
});
```

---

## Production Checklist

- [ ] Test backup/restore with real data volume
- [ ] Verify connection pooling settings
- [ ] Test with MongoDB replica sets
- [ ] Handle network timeouts gracefully
- [ ] Implement retry logic for transient failures
- [ ] Monitor migration performance
- [ ] Document rollback procedures
- [ ] Test with production-like data volumes

---

