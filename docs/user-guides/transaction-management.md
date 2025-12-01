---
layout: default
title: Transaction Management
parent: User Guides
nav_order: 7
---

# Transaction Management
{: .no_toc }

Comprehensive guide to MSR's transaction management system for reliable, ACID-compliant migrations.
{: .fs-6 .fw-300 }

## What You'll Learn

- Understanding transaction modes (PER_MIGRATION, PER_BATCH, NONE)
- SQL databases: Implementing ITransactionalDB with isolation levels
- **NoSQL databases: Implementing ICallbackTransactionalDB for Firestore, MongoDB** (New in v0.5.0)
- **Hybrid migrations constraint: Why SQL + TypeScript migrations require NONE mode**
- Configuring automatic retry logic for transient errors
- Best practices for production deployments
- Troubleshooting transaction failures (SQL and NoSQL)

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

**New in v0.5.0**

MSR provides robust transaction management to ensure your database migrations are executed reliably with full ACID guarantees. The transaction system offers:

- **Flexible Transaction Modes**: Choose per-migration, per-batch, or no transaction wrapping
- **Automatic Retry Logic**: Built-in retry with exponential backoff for transient failures
- **Isolation Level Control**: Configure SQL isolation levels per your requirements
- **Intelligent Error Detection**: Distinguishes between retriable and non-retriable errors

{: .note }
> Transaction management requires your database handler to implement either `ITransactionalDB` (for SQL databases) or `ICallbackTransactionalDB` (for NoSQL databases). MSR automatically detects your database type and uses the appropriate transaction manager, or you can provide a custom `ITransactionManager` implementation.

{: .important }
> **New in v0.5.0:** MSR validates transaction configuration before migrations run. If your database doesn't support transactions but `transaction.mode` is enabled, validation will fail with a clear error message. See [Transaction Validation](#transaction-validation) section below.

---

## Transaction Modes

MSR supports three transaction modes to accommodate different migration strategies:

### PER_MIGRATION Mode (Default)

Each migration runs in its own transaction. If a migration fails, only that migration is rolled back.

**Use When:**
- Migrations are independent and self-contained
- You want to maximize progress even if some migrations fail
- Individual migrations can fail without affecting others

**Example:**
```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';

const config = new Config();
config.transaction.mode = 'PER_MIGRATION';  // Default
config.transaction.isolation = 'READ COMMITTED';

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

**Behavior:**
```
Migration 1: BEGIN → Execute → COMMIT ✓
Migration 2: BEGIN → Execute → COMMIT ✓
Migration 3: BEGIN → Execute → ROLLBACK ✗ (failure)
Migration 4: Not executed (stopped at first failure)

Result: Migrations 1 and 2 are committed, 3 is rolled back
```

### PER_BATCH Mode

All migrations in a batch run in a single transaction. If any migration fails, the entire batch is rolled back.

**Use When:**
- Migrations are interdependent
- You need all-or-nothing semantics
- Rolling back partial progress is preferred over partial success

**Example:**
```typescript
const config = new Config();
config.transaction.mode = 'PER_BATCH';
config.transaction.retries = 5;  // Retry entire batch on transient errors

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();  // All migrations in single transaction
```

**Behavior:**
```
BEGIN
  Migration 1: Execute ✓
  Migration 2: Execute ✓
  Migration 3: Execute ✗ (failure)
ROLLBACK

Result: All migrations rolled back, database unchanged
```

### NONE Mode

No transaction wrapping. Each migration's `up()` method is responsible for its own transaction management.

**Use When:**
- Migrations need custom transaction boundaries
- Using DDL statements that can't run in transactions (some databases)
- Maximum control over transaction logic is required
- NoSQL databases where automatic transaction wrapping is not desired
- **Mixing SQL and TypeScript migrations** (required - see constraint below)

**Example:**
```typescript
const config = new Config();
config.transaction.mode = 'NONE';

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

{: .warning }
> In NONE mode, MSR's automatic rollback will not work. Ensure your migrations handle errors and rollback appropriately.

{: .note }
> For NoSQL databases that support transactions (Firestore, MongoDB), you can use PER_MIGRATION or PER_BATCH modes by implementing `ICallbackTransactionalDB`. See the [NoSQL Database Support](#nosql-database-support) section below.

---

## Hybrid Migrations Constraint

**⚠️ Important Limitation**: You **cannot** use automatic transaction management (PER_MIGRATION or PER_BATCH modes) when mixing SQL (.up.sql) and TypeScript (.ts/.js) migrations in the same batch.

### Why This Constraint Exists

SQL files may contain their own `BEGIN;` and `COMMIT;` statements, which creates conflicting transaction boundaries with MSR's automatic transaction wrapping:

```sql
-- V001_CreateTable.up.sql
BEGIN;
CREATE TABLE users (...);
COMMIT;  -- ❌ Conflicts with MSR's automatic COMMIT
```

If MSR wraps this in its own transaction:
```
BEGIN                      -- MSR's transaction
  Execute V001_CreateTable.sql
    BEGIN                  -- SQL file's BEGIN
    CREATE TABLE...
    COMMIT                 -- ❌ Commits MSR's transaction prematurely!
  Execute V002_AddData.ts  -- ❌ Runs outside transaction!
COMMIT                     -- ❌ No transaction to commit!
```

### Detection and Error

MSR automatically detects hybrid migrations and throws an error:

```
❌ Hybrid migrations detected: Cannot use automatic transaction management.

Pending migrations contain both SQL and TypeScript files:
  SQL files: V001_CreateTable.up.sql, V003_AlterTable.up.sql
  TypeScript/JavaScript files: V002_InsertData.ts, V004_UpdateRecords.ts

SQL files may contain their own BEGIN/COMMIT statements, which creates
conflicting transaction boundaries with automatic transaction management.

To fix this, choose ONE of these options:

1. Set transaction mode to NONE (each migration manages its own transactions):
   config.transaction.mode = TransactionMode.NONE;

2. Separate SQL and TypeScript migrations into different batches

3. Convert all migrations to use the same format (either all SQL or all TS)

Current transaction mode: PER_MIGRATION
```

### Solution Options

#### Option 1: Use NONE Mode (Recommended for Hybrid)

```typescript
const config = new Config();
config.transaction.mode = TransactionMode.NONE;

// SQL migrations manage their own transactions
// V001_CreateTable.up.sql:
//   BEGIN;
//   CREATE TABLE users (...);
//   COMMIT;

// TypeScript migrations also manage their own transactions
// V002_InsertData.ts:
export const up = async (db: ITransactionalDB) => {
  await db.beginTransaction();
  try {
    await db.query('INSERT INTO users ...');
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
};
```

#### Option 2: Separate into Different Batches

Run SQL and TypeScript migrations separately:

```bash
# Batch 1: SQL migrations only
config.transaction.mode = TransactionMode.PER_BATCH;
npm run migrate:sql

# Batch 2: TypeScript migrations only
config.transaction.mode = TransactionMode.PER_MIGRATION;
npm run migrate:ts
```

#### Option 3: Use Single Format

Convert all migrations to one format:

```typescript
// Convert SQL to TypeScript
export const up = async (db: ISqlDB) => {
  await db.query(`
    CREATE TABLE users (
      id INT PRIMARY KEY,
      name VARCHAR(255)
    )
  `);
};
```

Or convert TypeScript to SQL (if logic is simple enough).

### Best Practices

1. **Choose one format per project**: Stick with either SQL or TypeScript migrations
2. **If mixing is necessary**: Use `TransactionMode.NONE` and manage transactions manually
3. **Document the approach**: Add comments explaining why NONE mode is used
4. **Test thoroughly**: Manual transaction management requires extra care

---

## Isolation Levels

Control transaction isolation to balance consistency and performance:

### Supported Isolation Levels

```typescript
import { IsolationLevel } from '@migration-script-runner/core';

config.transaction.isolation = IsolationLevel.READ_UNCOMMITTED;  // Lowest isolation
config.transaction.isolation = IsolationLevel.READ_COMMITTED;    // Default for most DBs
config.transaction.isolation = IsolationLevel.REPEATABLE_READ;   // Prevent phantom reads
config.transaction.isolation = IsolationLevel.SERIALIZABLE;      // Highest isolation
```

### Isolation Level Comparison

| Level | Dirty Reads | Non-Repeatable Reads | Phantom Reads | Use Case |
|-------|-------------|----------------------|---------------|----------|
| **READ UNCOMMITTED** | ✓ Possible | ✓ Possible | ✓ Possible | Development, non-critical data |
| **READ COMMITTED** | ✗ Prevented | ✓ Possible | ✓ Possible | **Default**, most applications |
| **REPEATABLE READ** | ✗ Prevented | ✗ Prevented | ✓ Possible | Financial data, reporting |
| **SERIALIZABLE** | ✗ Prevented | ✗ Prevented | ✗ Prevented | Critical transactions, auditing |

### Example: Production Configuration

```typescript
const config = new Config();
config.transaction.mode = 'PER_BATCH';
config.transaction.isolation = IsolationLevel.SERIALIZABLE;
config.transaction.retries = 3;
config.transaction.retryDelay = 200;  // 200ms base delay
config.transaction.retryBackoff = true;  // Exponential backoff

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

---

## Automatic Retry Logic

MSR automatically retries commit operations on transient errors with exponential backoff.

### Retriable Errors

The following error patterns trigger automatic retry:

- **Deadlock**: `deadlock detected`, `Deadlock found when trying to get lock`
- **Lock Timeout**: `lock timeout`, `lock wait timeout exceeded`
- **Serialization Failure**: `serialization failure`, `could not serialize access`
- **Connection Issues**: `connection lost`, `connection closed`, `connection reset`

### Non-Retriable Errors

These errors fail immediately without retry:

- **Constraint Violations**: `UNIQUE constraint failed`, `FOREIGN KEY constraint failed`
- **Data Errors**: `NOT NULL constraint`, `invalid input syntax`, `division by zero`
- **Permission Errors**: `permission denied`, `access denied`

### Configuration

```typescript
const config = new Config();

// Retry settings
config.transaction.retries = 5;           // Max retry attempts (default: 3)
config.transaction.retryDelay = 100;      // Base delay in ms (default: 100)
config.transaction.retryBackoff = true;   // Enable exponential backoff (default: true)

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

### Retry Behavior with Exponential Backoff

```
Attempt 1: Execute → FAIL (deadlock)
Wait 100ms...

Attempt 2: Execute → FAIL (deadlock)
Wait 200ms...

Attempt 3: Execute → FAIL (deadlock)
Wait 400ms...

Attempt 4: Execute → SUCCESS ✓
```

**Without Exponential Backoff** (`retryBackoff: false`):
```
Each retry waits: 100ms (fixed delay)
```

---

## Implementing ITransactionalDB

Your database handler must implement `ITransactionalDB` to use transaction management:

### Basic Implementation

```typescript
import { ITransactionalDB, IDB } from '@migration-script-runner/core';
import { Pool } from 'pg';

class PostgresDB implements ITransactionalDB {
  private pool: Pool;
  private client: PoolClient | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  async beginTransaction(): Promise<void> {
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
  }

  async commit(): Promise<void> {
    if (!this.client) throw new Error('No active transaction');

    try {
      await this.client.query('COMMIT');
    } finally {
      this.client.release();
      this.client = null;
    }
  }

  async rollback(): Promise<void> {
    if (!this.client) throw new Error('No active transaction');

    try {
      await this.client.query('ROLLBACK');
    } finally {
      this.client.release();
      this.client = null;
    }
  }

  async setIsolationLevel(level: string): Promise<void> {
    if (!this.client) throw new Error('Call beginTransaction() first');
    await this.client.query(`SET TRANSACTION ISOLATION LEVEL ${level}`);
  }
}
```

### SQL Database (ISqlDB)

For SQL databases, also implement `ISqlDB` for SQL migration support:

```typescript
import { ISqlDB } from '@migration-script-runner/core';

class PostgresDB implements ISqlDB {
  // ... ITransactionalDB methods ...

  async query(sql: string): Promise<unknown> {
    const client = this.client || await this.pool.connect();
    try {
      const result = await client.query(sql);
      return result.rows;
    } finally {
      if (!this.client) {
        client.release();
      }
    }
  }
}
```

---

## NoSQL Database Support

**New in v0.5.0**

MSR supports NoSQL databases with callback-based transaction APIs through the `ICallbackTransactionalDB` interface. This enables automatic transaction management for databases like Firestore and MongoDB.

### How It Works

NoSQL databases often use callback-based transaction APIs where all operations are wrapped in a single transaction callback:

```typescript
// Firestore example
await firestore.runTransaction(async (tx) => {
  const doc = await tx.get(docRef);
  tx.update(docRef, { count: doc.data().count + 1 });
});
```

MSR's `CallbackTransactionManager` automatically:
1. Buffers operations during migration execution
2. Executes all operations in a single `runTransaction()` call on commit
3. Retries transient errors (conflicts, contentions) with exponential backoff
4. Clears operations on rollback

### Implementing ICallbackTransactionalDB

#### Firestore Example

```typescript
import { Firestore, Transaction } from '@google-cloud/firestore';
import { ICallbackTransactionalDB } from '@migration-script-runner/core';

class FirestoreDB implements ICallbackTransactionalDB<Transaction> {
  constructor(private firestore: Firestore) {}

  async checkConnection(): Promise<boolean> {
    try {
      await this.firestore.collection('_health').limit(1).get();
      return true;
    } catch {
      return false;
    }
  }

  async runTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.firestore.runTransaction(callback);
  }
}

// Usage
const firestore = new Firestore();
const db = new FirestoreDB(firestore);

const handler: IDatabaseMigrationHandler = {
  db,
  schemaVersion: new FirestoreSchemaVersion(firestore),
  getName: () => 'Firestore Handler',
  getVersion: () => '1.0.0'
};

const config = new Config();
config.transaction.mode = 'PER_MIGRATION';  // Auto-uses CallbackTransactionManager
config.transaction.retries = 5;
config.transaction.retryBackoff = true;

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

#### MongoDB Example

```typescript
import { MongoClient, ClientSession } from 'mongodb';
import { ICallbackTransactionalDB } from '@migration-script-runner/core';

class MongoDBDatabase implements ICallbackTransactionalDB<ClientSession> {
  constructor(private client: MongoClient) {}

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.db('admin').command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async runTransaction<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        return await callback(session);
      });
    } finally {
      await session.endSession();
    }
  }
}

// Usage
const client = new MongoClient(uri);
await client.connect();

const db = new MongoDBDatabase(client);
const handler: IDatabaseMigrationHandler = {
  db,
  schemaVersion: new MongoSchemaVersion(client),
  getName: () => 'MongoDB Handler',
  getVersion: () => '1.0.0'
};

const config = new Config();
config.transaction.mode = 'PER_BATCH';  // All migrations in one transaction
config.transaction.retries = 3;

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

### Writing NoSQL Migrations

Migrations for NoSQL databases work the same as SQL migrations:

```typescript
import { IMigrationScript, IMigrationInfo } from '@migration-script-runner/core';
import { Transaction } from '@google-cloud/firestore';

export const up: IMigrationScript = async (db, info: IMigrationInfo, handler) => {
  const firestore = (handler.db as FirestoreDB).firestore;

  // Firestore transaction (automatically managed by MSR)
  await db.runTransaction!(async (tx: Transaction) => {
    const usersSnapshot = await tx.get(firestore.collection('users'));

    usersSnapshot.docs.forEach(doc => {
      tx.update(doc.ref, {
        migrated: true,
        migratedAt: new Date(),
        version: info.version
      });
    });
  });
};

export const down: IMigrationScript = async (db, info: IMigrationInfo, handler) => {
  const firestore = (handler.db as FirestoreDB).firestore;

  await db.runTransaction!(async (tx: Transaction) => {
    const usersSnapshot = await tx.get(
      firestore.collection('users').where('migrated', '==', true)
    );

    usersSnapshot.docs.forEach(doc => {
      tx.update(doc.ref, {
        migrated: false,
        migratedAt: null
      });
    });
  });
};
```

### Transaction Modes for NoSQL

All transaction modes work with NoSQL databases:

#### PER_MIGRATION Mode (Recommended)
```typescript
config.transaction.mode = 'PER_MIGRATION';
// Each migration runs in its own runTransaction() call
// Best for independent migrations
```

**Behavior:**
```
Migration 1: runTransaction(() => execute()) ✓
Migration 2: runTransaction(() => execute()) ✓
Migration 3: runTransaction(() => execute()) ✗
Result: Migrations 1 and 2 committed, 3 rolled back
```

#### PER_BATCH Mode
```typescript
config.transaction.mode = 'PER_BATCH';
// All migrations in single runTransaction() call
// Best for interdependent migrations
```

**Behavior:**
```
runTransaction(() => {
  Migration 1: execute() ✓
  Migration 2: execute() ✓
  Migration 3: execute() ✗
}) → Entire transaction rolled back
```

#### NONE Mode
```typescript
config.transaction.mode = 'NONE';
// Your migrations manage transactions manually
```

### Retry Logic for NoSQL

NoSQL databases often have their own retry mechanisms, but MSR provides additional retry logic at the migration level:

**Retriable Errors:**
- `conflict` - Write conflicts (Firestore)
- `contention` - Lock contention
- `deadlock` - Deadlock detected
- `timeout` - Operation timeout

**Configuration:**
```typescript
config.transaction.retries = 5;           // Max attempts
config.transaction.retryDelay = 100;      // Base delay (ms)
config.transaction.retryBackoff = true;   // Exponential backoff

// Retry behavior:
// Attempt 1: FAIL (conflict) → Wait 100ms
// Attempt 2: FAIL (conflict) → Wait 200ms
// Attempt 3: FAIL (conflict) → Wait 400ms
// Attempt 4: SUCCESS ✓
```

### Isolation Levels (Not Applicable)

NoSQL databases typically don't support SQL-style isolation levels. If you set an isolation level:

```typescript
config.transaction.isolation = IsolationLevel.SERIALIZABLE;
```

MSR will log a warning and continue:
```
WARN: Callback-style transactions do not support SQL isolation levels (requested: SERIALIZABLE)
```

This is expected behavior and can be safely ignored for NoSQL databases.

### Automatic Detection

MSR automatically detects whether your database uses callback or imperative transactions:

```typescript
// MSR checks at runtime:
if (db has beginTransaction/commit/rollback) {
  // Use DefaultTransactionManager (SQL-style)
} else if (db has runTransaction) {
  // Use CallbackTransactionManager (NoSQL-style)
} else {
  // Warn: Transaction mode configured but db doesn't support transactions
}
```

You don't need to explicitly choose the transaction manager - MSR does it for you.

---

## Transaction Hooks

Monitor and react to transaction lifecycle events:

```typescript
import { ITransactionHooks } from '@migration-script-runner/core';

const hooks: ITransactionHooks = {
  async beforeBeginTransaction() {
    console.log('Starting transaction...');
  },

  async afterBeginTransaction() {
    console.log('Transaction started');
  },

  async beforeCommit() {
    console.log('Committing transaction...');
  },

  async afterCommit() {
    console.log('Transaction committed successfully');
  },

  async beforeRollback(context, reason) {
    console.error(`Rolling back: ${reason}`);
  },

  async afterRollback(context) {
    console.log('Transaction rolled back');
  }
};

const executor = new MigrationScriptExecutor(handler, config, hooks);
await executor.migrate();
```

---

## Environment Variables

Configure transactions via environment variables:

```bash
# Transaction mode
export MSR_TRANSACTION_MODE=PER_BATCH

# Isolation level
export MSR_TRANSACTION_ISOLATION="SERIALIZABLE"

# Retry settings
export MSR_TRANSACTION_RETRIES=5
export MSR_TRANSACTION_RETRY_DELAY=200
export MSR_TRANSACTION_RETRY_BACKOFF=true

# Timeout (optional, database-specific)
export MSR_TRANSACTION_TIMEOUT=30000  # 30 seconds
```

Or via JSON:
```bash
export MSR_TRANSACTION='{"mode":"PER_BATCH","isolation":"SERIALIZABLE","retries":5}'
```

---

## Production Best Practices

### 1. Choose the Right Transaction Mode

```typescript
// ✓ GOOD: Independent schema changes
config.transaction.mode = 'PER_MIGRATION';

// ✓ GOOD: Related data migrations
config.transaction.mode = 'PER_BATCH';

// ⚠ CAUTION: Only if migrations manage transactions
config.transaction.mode = 'NONE';
```

### 2. Set Appropriate Isolation Levels

```typescript
// ✓ GOOD: Balance consistency and performance
config.transaction.isolation = IsolationLevel.READ_COMMITTED;

// ⚠ CAREFUL: Use only when necessary (can cause deadlocks)
config.transaction.isolation = IsolationLevel.SERIALIZABLE;
```

### 3. Configure Reasonable Retry Settings

```typescript
// ✓ GOOD: Handle transient errors gracefully
config.transaction.retries = 3;
config.transaction.retryDelay = 100;
config.transaction.retryBackoff = true;

// ✗ BAD: Too many retries can mask real issues
config.transaction.retries = 100;
```

### 4. Monitor Transaction Failures

```typescript
const hooks: ITransactionHooks = {
  async beforeRollback(context, reason) {
    // Log to monitoring system
    logger.error('Transaction rollback', {
      reason,
      migrationCount: context.allScripts.length
    });

    // Alert on production
    if (process.env.NODE_ENV === 'production') {
      await alerting.send('Migration rollback occurred');
    }
  }
};
```

### 5. Test with Different Modes

```typescript
// Test in development with PER_MIGRATION
// Deploy to staging with PER_BATCH
// Validate in production with same settings as staging
```

---

## Troubleshooting

### Problem: Deadlocks During Migration

**Symptoms:**
```
Error: deadlock detected
Transaction rolled back after 3 attempts
```

**Solutions:**
1. Increase retry attempts:
   ```typescript
   config.transaction.retries = 5;
   config.transaction.retryDelay = 200;
   ```

2. Use lower isolation level:
   ```typescript
   config.transaction.isolation = IsolationLevel.READ_COMMITTED;
   ```

3. Run migrations during low-traffic periods

4. Review migration order for lock conflicts

### Problem: "Database does not support transactions"

**Symptoms:**
```
WARN: Transaction mode is configured but database does not support transactions
```

**Solution:**
Implement either `ITransactionalDB` (SQL) or `ICallbackTransactionalDB` (NoSQL):

**SQL Databases:**
```typescript
class PostgresDB implements ITransactionalDB {
  async beginTransaction() { /* ... */ }
  async commit() { /* ... */ }
  async rollback() { /* ... */ }
}
```

**NoSQL Databases:**
```typescript
class FirestoreDB implements ICallbackTransactionalDB<Transaction> {
  async runTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.firestore.runTransaction(callback);
  }
}
```

### Problem: Rollback Fails

**Symptoms:**
```
CRITICAL: Rollback failed: connection lost
Database may be in inconsistent state
```

**Actions:**
1. **Immediate**: Check database connection
2. **Investigate**: Review transaction logs
3. **Recovery**: Manually verify database state
4. **Prevention**: Ensure stable database connections

{: .warning }
> Rollback failures are critical. MSR does NOT retry rollback operations. Investigate immediately.

### Problem: Long-Running Transactions

**Symptoms:**
- Migrations timeout
- Lock wait timeout exceeded
- Other database operations blocked

**Solutions:**
1. Break large migrations into smaller batches:
   ```typescript
   config.transaction.mode = 'PER_MIGRATION';  // Smaller tx boundaries
   ```

2. Set transaction timeout:
   ```typescript
   config.transaction.timeout = 60000;  // 60 seconds
   ```

3. Run data-heavy migrations outside transaction:
   ```typescript
   config.transaction.mode = 'NONE';
   // Handle transactions manually in migration
   ```

### Problem: Firestore "Transaction Conflict" Errors

**Symptoms:**
```
Error: Transaction conflict: Multiple writes to same document
Retrying transaction (attempt 2/3)...
```

**Causes:**
- Multiple migrations updating the same documents
- Document read in one migration, updated in another
- High contention on popular documents

**Solutions:**
1. Increase retry attempts for Firestore:
   ```typescript
   config.transaction.retries = 10;  // Firestore often needs more retries
   config.transaction.retryBackoff = true;
   config.transaction.retryDelay = 200;
   ```

2. Use PER_MIGRATION mode to reduce transaction scope:
   ```typescript
   config.transaction.mode = 'PER_MIGRATION';  // Smaller tx = less conflict
   ```

3. Batch document updates within migration:
   ```typescript
   export const up = async (db, info, handler) => {
     const firestore = (handler.db as FirestoreDB).firestore;

     // Query outside transaction, update inside
     const usersSnapshot = await firestore.collection('users').get();
     const docRefs = usersSnapshot.docs.map(d => d.ref);

     await db.runTransaction!(async (tx: Transaction) => {
       // Batch read documents
       const docs = await Promise.all(docRefs.map(ref => tx.get(ref)));

       // Batch update (no conflicts if only these migrations run)
       docs.forEach(doc => {
         tx.update(doc.ref, { migrated: true });
       });
     });
   };
   ```

4. Avoid reading and writing same document:
   ```typescript
   // ✗ BAD: Read-then-write pattern (causes conflicts)
   const doc = await tx.get(docRef);
   tx.update(docRef, { count: doc.data().count + 1 });

   // ✓ GOOD: Write-only pattern (no conflicts)
   tx.set(docRef, { migrated: true, version: info.version });
   ```

### Problem: MongoDB "TransientTransactionError"

**Symptoms:**
```
Error: TransientTransactionError: Transaction was aborted
Retrying transaction (attempt 2/3)...
```

**Causes:**
- Replica set configuration issues
- Network instability
- High write contention
- Transaction timeout

**Solutions:**
1. Ensure MongoDB replica set is properly configured:
   ```bash
   # MongoDB must be running as replica set for transactions
   mongod --replSet rs0
   ```

2. Configure appropriate retry settings:
   ```typescript
   config.transaction.retries = 5;
   config.transaction.retryDelay = 500;  // MongoDB may need longer delays
   config.transaction.retryBackoff = true;
   ```

3. Set transaction timeout:
   ```typescript
   config.transaction.timeout = 30000;  // 30 seconds
   ```

4. Use sessions correctly in migrations:
   ```typescript
   export const up = async (db, info, handler) => {
     const client = (handler.db as MongoDBDatabase).client;
     const database = client.db('mydb');

     await db.runTransaction!(async (session: ClientSession) => {
       // Pass session to all operations
       await database.collection('users').updateMany(
         { migrated: false },
         { $set: { migrated: true } },
         { session }  // ← Important: pass session
       );
     });
   };
   ```

### Problem: NoSQL Database Doesn't Support Transactions

**Symptoms:**
```
Error: runTransaction is not a function
```

**Example Databases:**
- DynamoDB (limited transaction support)
- Cassandra (no ACID transactions)
- Redis (no multi-document transactions)
- CouchDB (eventual consistency)

**Solution:**
Use `TransactionMode.NONE` and manage consistency in your migrations:

```typescript
const config = new Config();
config.transaction.mode = 'NONE';  // No automatic transactions

// Implement idempotency in migrations
export const up = async (db, info, handler) => {
  const redis = (handler.db as RedisDB).client;

  // Check if already migrated (idempotency)
  const migrated = await redis.get(`migration:${info.version}`);
  if (migrated) {
    console.log(`Migration ${info.version} already applied`);
    return;
  }

  // Apply migration
  await redis.set('user:1:migrated', 'true');
  await redis.set('user:2:migrated', 'true');

  // Mark as migrated
  await redis.set(`migration:${info.version}`, 'true');
};
```

---

## Transaction Validation

**New in v0.5.0**

MSR automatically validates transaction configuration before migrations execute. This prevents common configuration mistakes and provides clear error messages.

### Validation Checks

#### 1. Database Transaction Support

**ERROR:** Database must implement `ITransactionalDB` or `ICallbackTransactionalDB` when transaction mode is enabled.

```typescript
// ❌ This will fail validation
const config = new Config();
config.transaction.mode = TransactionMode.PER_MIGRATION;

class BasicDB implements IDB {
  async checkConnection(): Promise<boolean> { return true; }
  // Missing: beginTransaction(), commit(), rollback()
}
```

**Error Message:**
```
❌ Transaction configuration validation failed:

  ❌ Database does not support transactions, but transaction mode is PER_MIGRATION
     Database must implement ITransactionalDB or ICallbackTransactionalDB.
     Set transaction.mode to NONE or implement transaction methods.
```

**Fix:**
```typescript
// ✅ Option 1: Implement ITransactionalDB
class PostgresDB implements ITransactionalDB {
  async checkConnection(): Promise<boolean> { /* ... */ }
  async beginTransaction(): Promise<void> { await this.client.query('BEGIN'); }
  async commit(): Promise<void> { await this.client.query('COMMIT'); }
  async rollback(): Promise<void> { await this.client.query('ROLLBACK'); }
}

// ✅ Option 2: Disable transactions
config.transaction.mode = TransactionMode.NONE;
```

---

#### 2. Isolation Level Support

**WARNING:** Database may not support `setIsolationLevel()` method.

```typescript
// ⚠️  This will show a warning
config.transaction.isolation = IsolationLevel.SERIALIZABLE;

class MyDB implements ITransactionalDB {
  // Has begin/commit/rollback but missing setIsolationLevel()
}
```

**Warning Message:**
```
⚠️  Transaction configuration warnings:

  ⚠️  Isolation level SERIALIZABLE is configured, but database may not support setIsolationLevel()
      Verify your database adapter implements setIsolationLevel() method.
      Isolation level may be ignored.
```

**Fix:**
```typescript
class MyDB implements ITransactionalDB {
  // ... other methods ...

  async setIsolationLevel(level: string): Promise<void> {
    if (!this.client) throw new Error('Call beginTransaction() first');
    await this.client.query(`SET TRANSACTION ISOLATION LEVEL ${level}`);
  }
}
```

---

#### 3. Rollback Strategy Compatibility

**WARNING:** `PER_BATCH` mode with `DOWN` strategy has limitations.

```typescript
// ⚠️  This will show a warning
config.transaction.mode = TransactionMode.PER_BATCH;
config.rollbackStrategy = RollbackStrategy.DOWN;
```

**Warning Message:**
```
⚠️  Transaction configuration warnings:

  ⚠️  Rollback strategy DOWN is not fully compatible with PER_BATCH transaction mode
      If a migration fails in PER_BATCH mode, the entire batch transaction will rollback.
      Individual migration down() methods cannot rollback within the batch.
      Consider using BACKUP or BOTH strategy with PER_BATCH mode.
```

**Why This Matters:**

In `PER_BATCH` mode, all migrations run in a single database transaction:
```
BEGIN
  Migration 1 ✓
  Migration 2 ✓
  Migration 3 ✗ (fails)
ROLLBACK  ← Database automatically rolls back entire batch
```

When the transaction is rolled back, the database state returns to the pre-transaction state. Migration `down()` methods cannot execute inside a rolled-back transaction, so they have no effect.

**Recommended Combinations:**
```typescript
// ✅ Good: PER_BATCH with BACKUP strategy
config.transaction.mode = TransactionMode.PER_BATCH;
config.rollbackStrategy = RollbackStrategy.BACKUP;

// ✅ Good: PER_MIGRATION with DOWN strategy
config.transaction.mode = TransactionMode.PER_MIGRATION;
config.rollbackStrategy = RollbackStrategy.DOWN;

// ✅ Good: PER_BATCH with BOTH strategy (backup + down)
config.transaction.mode = TransactionMode.PER_BATCH;
config.rollbackStrategy = RollbackStrategy.BOTH;
```

---

#### 4. Transaction Timeout Warnings

**WARNING:** Many migrations in `PER_BATCH` mode may timeout or hold locks too long.

**Scenario 1: Timeout Risk (>10 migrations with timeout)**
```typescript
config.transaction.mode = TransactionMode.PER_BATCH;
config.transaction.timeout = 5000;  // 5 seconds

// 15 pending migrations to execute
```

**Warning Message:**
```
⚠️  Transaction configuration warnings:

  ⚠️  15 migrations will execute in a single transaction (PER_BATCH mode)
      Transaction timeout is 5000ms. If migrations take too long, transaction may timeout.
      Consider using PER_MIGRATION mode or increasing timeout.
```

**Scenario 2: Long-Running Transaction (>20 migrations, no timeout)**
```typescript
config.transaction.mode = TransactionMode.PER_BATCH;
// No timeout configured

// 25 pending migrations to execute
```

**Warning Message:**
```
⚠️  Transaction configuration warnings:

  ⚠️  25 migrations will execute in a single long-running transaction
      Consider setting transaction.timeout or using PER_MIGRATION mode
      to avoid holding locks for extended periods.
```

**Solutions:**
```typescript
// Option 1: Use PER_MIGRATION for many migrations
config.transaction.mode = TransactionMode.PER_MIGRATION;

// Option 2: Increase timeout for long-running batches
config.transaction.timeout = 30000;  // 30 seconds

// Option 3: Run migrations in smaller batches
await executor.up(202501220500);  // First batch (5 migrations)
await executor.up(202501220800);  // Second batch (3 migrations)
```

---

### Disabling Validation

If you need to bypass transaction validation (not recommended):

```typescript
config.validateBeforeRun = false;  // ⚠️  Disables ALL validation (dangerous!)
```

{: .warning }
> Disabling validation removes safety checks. Only do this for debugging. Production deployments should always have validation enabled.

---

## Custom Transaction Manager

For advanced use cases, implement `ITransactionManager`:

```typescript
import { ITransactionManager, ITransactionalDB } from '@migration-script-runner/core';

class CustomTransactionManager implements ITransactionManager {
  constructor(
    private db: ITransactionalDB,
    private logger: ILogger
  ) {}

  async begin(): Promise<void> {
    this.logger.info('Starting custom transaction');
    await this.db.beginTransaction();
  }

  async commit(): Promise<void> {
    // Custom retry logic
    let attempts = 0;
    while (attempts < 5) {
      try {
        await this.db.commit();
        return;
      } catch (error) {
        attempts++;
        if (this.shouldRetry(error) && attempts < 5) {
          await this.delay(attempts * 1000);
          continue;
        }
        throw error;
      }
    }
  }

  async rollback(): Promise<void> {
    await this.db.rollback();
  }

  private shouldRetry(error: Error): boolean {
    return error.message.includes('deadlock') ||
           error.message.includes('timeout');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Use custom transaction manager
const txManager = new CustomTransactionManager(db, logger);
const executor = new MigrationScriptExecutor(
  handler,
  config,
  undefined,  // hooks
  txManager   // custom transaction manager
);
```

---

## Next Steps

- Read [Configuration: Transaction Settings](../configuration/transaction-settings.md) for detailed API reference
- Review [API: ITransactionalDB](../api/interfaces/db.md#itransactionaldb) interface documentation
- See [API: ITransactionManager](../api/interfaces/index.md#itransactionmanager) for custom implementations
- Check [Recipes: Testing Migrations](../recipes/testing-migrations.md) for testing strategies

---

**Need Help?**

- Report issues: [GitHub Issues](https://github.com/username/msr/issues)
- Read: [API Documentation](../api/index.md)
- Examples: [Recipes](../recipes/index.md)
