# ITransactionalDB Interface

The `ITransactionalDB` interface extends the base `IDB` interface to add transaction management capabilities for SQL databases.

## Table of Contents

- [Overview](#overview)
- [Interface Definition](#interface-definition)
- [Methods](#methods)
- [Type Guards](#type-guards)
- [Implementation Examples](#implementation-examples)
- [Usage with Migration Runner](#usage-with-migration-runner)
- [Related Interfaces](#related-interfaces)

## Overview

`ITransactionalDB` is a capability interface that database handlers implement to support automatic transaction management. When a database implements this interface, Migration Script Runner can automatically wrap migrations in transactions based on the configured transaction mode.

**Key Features:**
- Extends `IDB` with transaction methods
- Enables automatic transaction wrapping
- Supports custom isolation levels
- Works with all standard SQL databases

**When to Implement:**
- SQL databases (PostgreSQL, MySQL, SQLite, etc.)
- Any database with transaction support
- When automatic transaction management is desired

**When NOT to Implement:**
- NoSQL databases without transactions
- When manual transaction control is preferred
- Use `TransactionMode.NONE` instead

## Interface Definition

```typescript
import { IDB } from './IDB';
import { IsolationLevel } from '../../model/IsolationLevel';

/**
 * Database interface with transaction support.
 *
 * Extends IDB with transaction management methods for SQL databases.
 * Implement this interface to enable automatic transaction wrapping
 * in Migration Script Runner.
 *
 * @extends IDB
 */
export interface ITransactionalDB extends IDB {
  /**
   * Begin a new database transaction.
   *
   * Starts a transaction that will wrap one or more migration operations.
   * The transaction remains open until commit() or rollback() is called.
   *
   * @returns Promise that resolves when transaction has started
   * @throws Error if transaction cannot be started (connection issues, etc.)
   *
   * @example
   * ```typescript
   * await db.beginTransaction();
   * try {
   *   await db.execute('INSERT INTO users...');
   *   await db.commit();
   * } catch (error) {
   *   await db.rollback();
   *   throw error;
   * }
   * ```
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction.
   *
   * Persists all changes made within the transaction to the database.
   * After commit, a new transaction must be started before making more changes.
   *
   * @returns Promise that resolves when transaction is committed
   * @throws Error if commit fails (constraint violations, deadlocks, etc.)
   *
   * @example
   * ```typescript
   * await db.beginTransaction();
   * await db.execute('UPDATE accounts SET balance = balance + 100');
   * await db.commit(); // Changes are now permanent
   * ```
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction.
   *
   * Discards all changes made within the transaction. Database returns
   * to the state before beginTransaction() was called.
   *
   * @returns Promise that resolves when transaction is rolled back
   * @throws Error if rollback fails (rare, usually indicates severe issues)
   *
   * @example
   * ```typescript
   * await db.beginTransaction();
   * try {
   *   await db.execute('UPDATE accounts...');
   *   await db.commit();
   * } catch (error) {
   *   await db.rollback(); // Undo all changes
   *   throw error;
   * }
   * ```
   */
  rollback(): Promise<void>;

  /**
   * Set the transaction isolation level (optional).
   *
   * Controls the visibility of changes made by concurrent transactions.
   * This method is optional - if not implemented, the database's default
   * isolation level is used.
   *
   * Should be called before beginTransaction() to take effect for the
   * next transaction.
   *
   * @param level - SQL transaction isolation level
   * @returns Promise that resolves when isolation level is set
   * @throws Error if isolation level is not supported by the database
   *
   * @example
   * ```typescript
   * await db.setIsolationLevel(IsolationLevel.SERIALIZABLE);
   * await db.beginTransaction();
   * // Transaction runs with SERIALIZABLE isolation
   * ```
   */
  setIsolationLevel?(level: IsolationLevel): Promise<void>;
}
```

## Methods

### beginTransaction()

**Signature:** `beginTransaction(): Promise<void>`

Begins a new database transaction. All subsequent database operations will be part of this transaction until `commit()` or `rollback()` is called.

**Behavior:**
- Starts a new transaction scope
- Subsequent operations are isolated based on isolation level
- Transaction remains open until explicitly committed or rolled back

**Typical Implementation:**
```typescript
// PostgreSQL
async beginTransaction(): Promise<void> {
  await this.pool.query('BEGIN');
}

// MySQL
async beginTransaction(): Promise<void> {
  await this.connection.beginTransaction();
}

// SQLite
async beginTransaction(): Promise<void> {
  await this.db.run('BEGIN TRANSACTION');
}
```

### commit()

**Signature:** `commit(): Promise<void>`

Commits the current transaction, making all changes permanent.

**Behavior:**
- Persists all changes to database
- Releases locks held by transaction
- Transaction ends (new one needed for more changes)

**Typical Implementation:**
```typescript
// PostgreSQL
async commit(): Promise<void> {
  await this.pool.query('COMMIT');
}

// MySQL
async commit(): Promise<void> {
  await this.connection.commit();
}

// SQLite
async commit(): Promise<void> {
  await this.db.run('COMMIT');
}
```

**Error Handling:**
Commit can fail due to:
- Constraint violations
- Deadlocks (will trigger automatic retry)
- Serialization failures (will trigger automatic retry)
- Connection issues (will trigger automatic retry)

Migration Script Runner automatically retries retriable errors.

### rollback()

**Signature:** `rollback(): Promise<void>`

Rolls back the current transaction, discarding all changes.

**Behavior:**
- Discards all changes since beginTransaction()
- Releases locks held by transaction
- Database returns to pre-transaction state

**Typical Implementation:**
```typescript
// PostgreSQL
async rollback(): Promise<void> {
  await this.pool.query('ROLLBACK');
}

// MySQL
async rollback(): Promise<void> {
  await this.connection.rollback();
}

// SQLite
async rollback(): Promise<void> {
  await this.db.run('ROLLBACK');
}
```

### setIsolationLevel() (Optional)

**Signature:** `setIsolationLevel(level: IsolationLevel): Promise<void>`

Sets the transaction isolation level for the next transaction. This method is optional.

**Parameters:**
- `level` - One of: `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`

**Behavior:**
- Affects next transaction (call before beginTransaction)
- Controls visibility of concurrent changes
- Higher levels provide stronger guarantees but may reduce performance

**Typical Implementation:**
```typescript
// PostgreSQL
async setIsolationLevel(level: IsolationLevel): Promise<void> {
  const mapping = {
    [IsolationLevel.READ_UNCOMMITTED]: 'READ UNCOMMITTED',
    [IsolationLevel.READ_COMMITTED]: 'READ COMMITTED',
    [IsolationLevel.REPEATABLE_READ]: 'REPEATABLE READ',
    [IsolationLevel.SERIALIZABLE]: 'SERIALIZABLE'
  };
  await this.pool.query(`SET TRANSACTION ISOLATION LEVEL ${mapping[level]}`);
}
```

**If Not Implemented:**
- Database uses its default isolation level
- No isolation level configuration available
- Still fully functional for transaction management

## Type Guards

Use type guards to check if a database supports transactions:

```typescript
import { ITransactionalDB } from '@migration-script-runner/core';

/**
 * Type guard to check if database implements ITransactionalDB.
 *
 * @param db - Database instance to check
 * @returns true if db implements ITransactionalDB interface
 */
export function isTransactionalDB(db: IDB): db is ITransactionalDB {
  return (
    typeof (db as ITransactionalDB).beginTransaction === 'function' &&
    typeof (db as ITransactionalDB).commit === 'function' &&
    typeof (db as ITransactionalDB).rollback === 'function'
  );
}

// Usage
if (isTransactionalDB(handler.db)) {
  await handler.db.beginTransaction();
  // ... perform operations
  await handler.db.commit();
} else {
  // Database doesn't support transactions
  // Use TransactionMode.NONE
}
```

## Implementation Examples

### Example 1: PostgreSQL with pg

```typescript
import { Pool } from 'pg';
import { ITransactionalDB, IsolationLevel } from '@migration-script-runner/core';

export class PostgresDB implements ITransactionalDB {
  constructor(private pool: Pool) {}

  async execute(sql: string): Promise<any[]> {
    const result = await this.pool.query(sql);
    return result.rows;
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async beginTransaction(): Promise<void> {
    await this.pool.query('BEGIN');
  }

  async commit(): Promise<void> {
    await this.pool.query('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.pool.query('ROLLBACK');
  }

  async setIsolationLevel(level: IsolationLevel): Promise<void> {
    const levelMap: Record<IsolationLevel, string> = {
      [IsolationLevel.READ_UNCOMMITTED]: 'READ UNCOMMITTED',
      [IsolationLevel.READ_COMMITTED]: 'READ COMMITTED',
      [IsolationLevel.REPEATABLE_READ]: 'REPEATABLE READ',
      [IsolationLevel.SERIALIZABLE]: 'SERIALIZABLE'
    };
    await this.pool.query(
      `SET TRANSACTION ISOLATION LEVEL ${levelMap[level]}`
    );
  }
}
```

### Example 2: MySQL with mysql2

```typescript
import mysql from 'mysql2/promise';
import { ITransactionalDB, IsolationLevel } from '@migration-script-runner/core';

export class MySQLDB implements ITransactionalDB {
  constructor(private connection: mysql.Connection) {}

  async execute(sql: string): Promise<any[]> {
    const [rows] = await this.connection.execute(sql);
    return rows as any[];
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.connection.ping();
      return true;
    } catch {
      return false;
    }
  }

  async beginTransaction(): Promise<void> {
    await this.connection.beginTransaction();
  }

  async commit(): Promise<void> {
    await this.connection.commit();
  }

  async rollback(): Promise<void> {
    await this.connection.rollback();
  }

  async setIsolationLevel(level: IsolationLevel): Promise<void> {
    const levelMap: Record<IsolationLevel, string> = {
      [IsolationLevel.READ_UNCOMMITTED]: 'READ UNCOMMITTED',
      [IsolationLevel.READ_COMMITTED]: 'READ COMMITTED',
      [IsolationLevel.REPEATABLE_READ]: 'REPEATABLE READ',
      [IsolationLevel.SERIALIZABLE]: 'SERIALIZABLE'
    };
    await this.connection.query(
      `SET TRANSACTION ISOLATION LEVEL ${levelMap[level]}`
    );
  }
}
```

### Example 3: SQLite with better-sqlite3

```typescript
import Database from 'better-sqlite3';
import { ITransactionalDB } from '@migration-script-runner/core';

export class SQLiteDB implements ITransactionalDB {
  constructor(private db: Database.Database) {}

  async execute(sql: string): Promise<any[]> {
    return this.db.prepare(sql).all();
  }

  async checkConnection(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  async beginTransaction(): Promise<void> {
    this.db.prepare('BEGIN TRANSACTION').run();
  }

  async commit(): Promise<void> {
    this.db.prepare('COMMIT').run();
  }

  async rollback(): Promise<void> {
    this.db.prepare('ROLLBACK').run();
  }

  // SQLite isolation level is set at connection level
  // This method can be omitted or implemented as no-op
}
```

### Example 4: Minimal Implementation (Without setIsolationLevel)

```typescript
import { ITransactionalDB } from '@migration-script-runner/core';

export class SimpleDB implements ITransactionalDB {
  // Only implement the three required methods
  // setIsolationLevel is optional

  async execute(sql: string): Promise<any[]> {
    // Your implementation
  }

  async checkConnection(): Promise<boolean> {
    // Your implementation
  }

  async beginTransaction(): Promise<void> {
    // Your implementation
  }

  async commit(): Promise<void> {
    // Your implementation
  }

  async rollback(): Promise<void> {
    // Your implementation
  }

  // No setIsolationLevel - database will use default
}
```

## Usage with Migration Runner

Once you implement `ITransactionalDB`, Migration Script Runner automatically detects and uses transaction capabilities:

```typescript
import {
  MigrationScriptExecutor,
  Config,
  TransactionMode
} from '@migration-script-runner/core';
import { PostgresDB } from './postgres-db';
import { createHandler } from './handler';

// Create database with transaction support
const db = new PostgresDB(pool);
const handler = createHandler(db);

// Configure transaction mode
const config = new Config();
config.transaction.mode = TransactionMode.PER_MIGRATION;

// Migration Script Runner automatically:
// 1. Detects ITransactionalDB implementation
// 2. Creates DefaultTransactionManager
// 3. Wraps migrations in transactions
// 4. Handles retries on deadlocks

const executor = new MigrationScriptExecutor(handler, config);
await executor.up();
```

**What Happens Automatically:**
1. ✅ Type guard checks if database implements `ITransactionalDB`
2. ✅ Creates `DefaultTransactionManager` for retry logic
3. ✅ Wraps migrations in `beginTransaction()` / `commit()` / `rollback()`
4. ✅ Sets isolation level if `setIsolationLevel()` is implemented
5. ✅ Automatically retries on deadlocks and serialization failures

## Related Interfaces

- **[IDB](./db.md)** - Base database interface (extended by ITransactionalDB)
- **[ITransactionManager](./transaction-manager.md)** - Transaction orchestration with retry logic
- **[ICallbackTransactionalDB](./db.md#icallbacktransactionaldb)** - Alternative transaction interface for NoSQL
- **[IDatabaseMigrationHandler](./database-handler.md)** - Main handler interface

## See Also

- [Transaction Management Guide](../../user-guides/transaction-management.md)
- [Transaction Configuration](../../configuration/transaction-settings.md)
- [IDB Interface Documentation](./db.md)
- [Custom Transaction Managers](../../customization/hooks.md#transaction-hooks)
