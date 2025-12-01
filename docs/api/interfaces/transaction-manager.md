---
layout: default
title: ITransactionManager
parent: Interfaces
grand_parent: API Reference
nav_order: 6
---

# ITransactionManager Interface
{: .no_toc }

The `ITransactionManager` interface provides transaction orchestration with automatic retry logic for transient failures. It wraps database transaction operations with resilience patterns.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

- [Overview](#overview)
- [Interface Definition](#interface-definition)
- [Methods](#methods)
- [Default Implementation](#default-implementation)
- [Custom Implementations](#custom-implementations)
- [Retry Logic](#retry-logic)
- [Transaction Hooks](#transaction-hooks)
- [Usage Examples](#usage-examples)
- [Related Interfaces](#related-interfaces)

## Overview

`ITransactionManager` orchestrates transaction lifecycle with built-in retry logic for common transient failures like deadlocks and serialization conflicts. It separates transaction orchestration from database-specific transaction commands.

**Key Features:**
- Automatic retry on transient failures (deadlocks, serialization errors)
- Configurable retry count and exponential backoff
- Transaction lifecycle hooks for monitoring
- Support for both SQL and NoSQL transaction patterns
- Production-ready out of the box

**Design Philosophy:**
- **Database interface (`ITransactionalDB`)** = "what" (execute BEGIN, COMMIT, ROLLBACK)
- **Transaction manager (`ITransactionManager`)** = "how" (when to retry, how long to wait)

## Interface Definition

```typescript
/**
 * Transaction manager for orchestrating database transactions with retry logic.
 *
 * Wraps ITransactionalDB or ICallbackTransactionalDB with resilience patterns
 * like automatic retry on deadlocks, serialization failures, and connection issues.
 *
 * @example
 * ```typescript
 * const txManager = new DefaultTransactionManager(db, config, logger, hooks);
 *
 * await txManager.begin();
 * try {
 *   // Perform operations
 *   await txManager.commit(); // Automatic retry on failure
 * } catch (error) {
 *   await txManager.rollback();
 *   throw error;
 * }
 * ```
 */
export interface ITransactionManager {
  /**
   * Begin a new transaction.
   *
   * Starts a new transaction scope. All subsequent database operations
   * will be part of this transaction until commit() or rollback() is called.
   *
   * Invokes transaction lifecycle hooks:
   * - beforeTransactionBegin (before starting)
   * - afterTransactionBegin (after started)
   *
   * @returns Promise that resolves when transaction has started
   * @throws Error if transaction cannot be started
   *
   * @example
   * ```typescript
   * await txManager.begin();
   * // Transaction is now active
   * ```
   */
  begin(): Promise<void>;

  /**
   * Commit the current transaction with automatic retry.
   *
   * Attempts to commit the transaction. If commit fails due to a retriable
   * error (deadlock, serialization failure, connection issue), automatically
   * retries with exponential backoff.
   *
   * Invokes transaction lifecycle hooks:
   * - beforeCommit (before each attempt)
   * - onCommitRetry (on each retry)
   * - afterCommit (after successful commit)
   *
   * @returns Promise that resolves when transaction is committed
   * @throws Error if commit fails after all retries exhausted
   *
   * @example
   * ```typescript
   * try {
   *   await txManager.commit();
   *   // Transaction committed successfully
   * } catch (error) {
   *   // All retries exhausted, transaction failed
   *   await txManager.rollback();
   *   throw error;
   * }
   * ```
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction.
   *
   * Discards all changes made within the transaction. Database returns
   * to the state before begin() was called.
   *
   * Invokes transaction lifecycle hooks:
   * - beforeRollback (before rollback)
   * - afterRollback (after rollback)
   *
   * @param reason - Optional error that caused the rollback
   * @returns Promise that resolves when transaction is rolled back
   *
   * @example
   * ```typescript
   * try {
   *   await txManager.commit();
   * } catch (error) {
   *   await txManager.rollback(error);
   *   throw error;
   * }
   * ```
   */
  rollback(reason?: Error): Promise<void>;
}
```

## Methods

### begin()

**Signature:** `begin(): Promise<void>`

Begins a new transaction. Must be called before any transactional operations.

**Behavior:**
- Calls `db.beginTransaction()` (SQL) or prepares transaction context (NoSQL)
- Invokes `beforeTransactionBegin` and `afterTransactionBegin` hooks
- Generates unique transaction ID for tracking
- No automatic retry (starting a transaction rarely fails)

**Hook Sequence:**
```typescript
1. beforeTransactionBegin(context)
2. db.beginTransaction()
3. afterTransactionBegin(context)
```

**Example:**
```typescript
const txManager = new DefaultTransactionManager(db, config, logger, hooks);

await txManager.begin();
console.log('Transaction started');
```

### commit()

**Signature:** `commit(): Promise<void>`

Commits the current transaction with automatic retry on transient failures.

**Behavior:**
- Attempts to commit transaction
- Detects retriable errors (deadlock, serialization failure, connection issues)
- Automatically retries with exponential backoff
- Invokes hooks at each stage

**Retriable Errors:**
- **Deadlocks**: `ER_LOCK_DEADLOCK`, `SQLITE_BUSY`
- **Serialization failures**: `40001`, `40P01`
- **Connection issues**: `ECONNRESET`, `ETIMEDOUT`, `EPIPE`

**Hook Sequence (with retry):**
```typescript
// First attempt
1. beforeCommit(context)
2. db.commit() → fails with deadlock
3. onCommitRetry(context, attempt=1, error)
4. Wait 100ms (exponential backoff)

// Second attempt
5. beforeCommit(context)
6. db.commit() → fails with deadlock
7. onCommitRetry(context, attempt=2, error)
8. Wait 200ms (exponential backoff)

// Third attempt
9. beforeCommit(context)
10. db.commit() → succeeds
11. afterCommit(context)
```

**Example:**
```typescript
try {
  await txManager.commit();
  console.log('Transaction committed');
} catch (error) {
  console.error('Commit failed after retries:', error);
  await txManager.rollback();
  throw error;
}
```

### rollback()

**Signature:** `rollback(reason?: Error): Promise<void>`

Rolls back the current transaction, discarding all changes.

**Parameters:**
- `reason` (optional) - Error that caused the rollback (for logging/hooks)

**Behavior:**
- Calls `db.rollback()`
- Invokes `beforeRollback` and `afterRollback` hooks
- Passes reason to hooks for context
- No automatic retry (rollback should not fail)

**Hook Sequence:**
```typescript
1. beforeRollback(context, reason)
2. db.rollback()
3. afterRollback(context)
```

**Example:**
```typescript
try {
  await db.execute('UPDATE...');
  await txManager.commit();
} catch (error) {
  await txManager.rollback(error); // Pass error for context
  throw error;
}
```

## Default Implementation

Migration Script Runner provides `DefaultTransactionManager` that implements `ITransactionManager` with production-ready retry logic.

### DefaultTransactionManager

**Auto-Created When:**
- Database implements `ITransactionalDB`
- Handler doesn't provide custom `transactionManager`
- Transaction mode is not `NONE`

**Features:**
- ✅ Automatic retry with exponential backoff
- ✅ Configurable retry count and delay
- ✅ Transaction lifecycle hooks
- ✅ Unique transaction IDs
- ✅ Works with both SQL and NoSQL patterns

**Constructor:**
```typescript
import {
  DefaultTransactionManager,
  ITransactionalDB,
  Config,
  ILogger,
  ITransactionHooks
} from '@migration-script-runner/core';

const txManager = new DefaultTransactionManager(
  db,       // ITransactionalDB instance
  config,   // Config with transaction settings
  logger,   // ILogger for logging
  hooks     // Optional transaction hooks
);
```

### Configuration

Retry behavior is controlled by `config.transaction`:

```typescript
const config = new Config();
config.transaction.retries = 3;          // Number of retry attempts
config.transaction.retryDelay = 100;     // Base delay in ms
config.transaction.retryBackoff = true;  // Exponential backoff
```

## Custom Implementations

You can provide a custom transaction manager for specialized behavior:

### Example 1: Custom Retry Logic

```typescript
import {
  ITransactionManager,
  ITransactionalDB,
  ITransactionContext
} from '@migration-script-runner/core';

export class CustomTransactionManager implements ITransactionManager {
  constructor(
    private db: ITransactionalDB,
    private maxRetries: number = 5
  ) {}

  async begin(): Promise<void> {
    await this.db.beginTransaction();
  }

  async commit(): Promise<void> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        await this.db.commit();
        return; // Success
      } catch (error) {
        if (this.isRetriable(error) && attempt < this.maxRetries - 1) {
          attempt++;
          // Custom backoff strategy
          await this.customBackoff(attempt);
        } else {
          throw error;
        }
      }
    }
  }

  async rollback(reason?: Error): Promise<void> {
    await this.db.rollback();
  }

  private isRetriable(error: any): boolean {
    // Custom logic to determine if error is retriable
    return error.code === 'DEADLOCK' || error.code === 'SERIALIZATION';
  }

  private async customBackoff(attempt: number): Promise<void> {
    // Custom backoff algorithm (e.g., Fibonacci)
    const delay = this.fibonacci(attempt) * 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2);
  }
}

// Usage
const handler: IDatabaseMigrationHandler = {
  db: myDB,
  schemaVersion: mySchemaVersion,
  transactionManager: new CustomTransactionManager(myDB, 5),
  getName: () => 'MyHandler',
  getVersion: () => '1.0.0'
};
```

### Example 2: Distributed Transaction Manager

```typescript
export class DistributedTransactionManager implements ITransactionManager {
  constructor(
    private coordinatorUrl: string,
    private participantDBs: ITransactionalDB[]
  ) {}

  async begin(): Promise<void> {
    // Two-phase commit prepare phase
    const txId = await this.coordinator.beginDistributedTransaction();
    for (const db of this.participantDBs) {
      await db.beginTransaction();
    }
  }

  async commit(): Promise<void> {
    // Two-phase commit protocol
    try {
      // Phase 1: Prepare
      for (const db of this.participantDBs) {
        await this.prepare(db);
      }
      // Phase 2: Commit
      await this.coordinator.commit();
      for (const db of this.participantDBs) {
        await db.commit();
      }
    } catch (error) {
      await this.rollback(error);
      throw error;
    }
  }

  async rollback(reason?: Error): Promise<void> {
    for (const db of this.participantDBs) {
      await db.rollback();
    }
    await this.coordinator.rollback();
  }

  private async prepare(db: ITransactionalDB): Promise<void> {
    // Prepare phase logic
  }
}
```

### Example 3: Transaction Manager with Circuit Breaker

```typescript
export class CircuitBreakerTransactionManager implements ITransactionManager {
  private failures = 0;
  private lastFailure: Date | null = null;
  private readonly threshold = 5;
  private readonly resetTimeout = 60000; // 1 minute

  constructor(private db: ITransactionalDB) {}

  async begin(): Promise<void> {
    if (this.isCircuitOpen()) {
      throw new Error('Circuit breaker is open, too many failures');
    }
    await this.db.beginTransaction();
  }

  async commit(): Promise<void> {
    try {
      await this.db.commit();
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  async rollback(reason?: Error): Promise<void> {
    await this.db.rollback();
  }

  private isCircuitOpen(): boolean {
    if (this.failures >= this.threshold) {
      const now = new Date();
      const timeSinceLastFailure = this.lastFailure
        ? now.getTime() - this.lastFailure.getTime()
        : Infinity;

      if (timeSinceLastFailure < this.resetTimeout) {
        return true; // Circuit is open
      } else {
        // Reset circuit breaker after timeout
        this.failures = 0;
        this.lastFailure = null;
        return false;
      }
    }
    return false;
  }

  private recordSuccess(): void {
    this.failures = 0;
    this.lastFailure = null;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();
  }
}
```

## Retry Logic

The default retry logic handles common transient database errors:

### Retriable Errors

```typescript
// Deadlocks
ER_LOCK_DEADLOCK        // MySQL
SQLITE_BUSY             // SQLite
deadlock detected       // PostgreSQL

// Serialization failures
40001                   // PostgreSQL serialization failure
40P01                   // PostgreSQL deadlock detected

// Connection issues
ECONNRESET              // Connection reset
ETIMEDOUT               // Connection timeout
EPIPE                   // Broken pipe
ENOTFOUND               // DNS lookup failure
```

### Retry Algorithm

**With Exponential Backoff (default):**
```typescript
config.transaction.retries = 3;
config.transaction.retryDelay = 100;
config.transaction.retryBackoff = true;

// Retry schedule:
Attempt 1: Immediate
Attempt 2: Wait 100ms  (100 * 2^0)
Attempt 3: Wait 200ms  (100 * 2^1)
Attempt 4: Wait 400ms  (100 * 2^2)
```

**Without Exponential Backoff:**
```typescript
config.transaction.retryBackoff = false;

// Retry schedule:
Attempt 1: Immediate
Attempt 2: Wait 100ms
Attempt 3: Wait 100ms
Attempt 4: Wait 100ms
```

### Retry Hooks

Monitor retry attempts with hooks:

```typescript
const hooks: ITransactionHooks = {
  onCommitRetry: async (context, attempt, error) => {
    console.log(`Commit retry ${attempt} due to: ${error.message}`);

    // Alert on excessive retries
    if (attempt > 2) {
      await alerting.send(`High contention detected: ${error.message}`);
    }
  }
};
```

## Transaction Hooks

Transaction managers support lifecycle hooks for monitoring and custom logic:

### Available Hooks

```typescript
interface ITransactionHooks {
  // Before starting transaction
  beforeTransactionBegin?(context: ITransactionContext): Promise<void>;

  // After starting transaction
  afterTransactionBegin?(context: ITransactionContext): Promise<void>;

  // Before commit attempt
  beforeCommit?(context: ITransactionContext): Promise<void>;

  // After successful commit
  afterCommit?(context: ITransactionContext): Promise<void>;

  // On commit retry (deadlock, serialization failure)
  onCommitRetry?(
    context: ITransactionContext,
    attempt: number,
    error: Error
  ): Promise<void>;

  // Before rollback
  beforeRollback?(context: ITransactionContext, reason: Error): Promise<void>;

  // After rollback
  afterRollback?(context: ITransactionContext): Promise<void>;
}
```

### Transaction Context

```typescript
interface ITransactionContext {
  transactionId: string;          // Unique ID for this transaction
  migrationScript?: MigrationScript; // Current migration (if applicable)
  mode: TransactionMode;          // PER_MIGRATION, PER_BATCH, NONE
  startTime: Date;                // When transaction began
  metadata?: Record<string, any>; // Custom metadata
}
```

### Hook Usage Example

```typescript
const hooks: ITransactionHooks = {
  afterTransactionBegin: async (context) => {
    console.log(`Transaction ${context.transactionId} started`);
  },

  onCommitRetry: async (context, attempt, error) => {
    console.warn(
      `Retrying commit (attempt ${attempt}) for transaction ${context.transactionId}`,
      error
    );
  },

  afterCommit: async (context) => {
    const duration = Date.now() - context.startTime.getTime();
    console.log(`Transaction ${context.transactionId} committed in ${duration}ms`);
  },

  beforeRollback: async (context, reason) => {
    console.error(
      `Rolling back transaction ${context.transactionId}`,
      reason
    );
  }
};

const executor = new MigrationScriptExecutor(handler, config, {
  logger,
  hooks
});
```

## Usage Examples

### Example 1: Basic Usage

```typescript
import {
  DefaultTransactionManager,
  Config
} from '@migration-script-runner/core';

const config = new Config();
config.transaction.retries = 3;

const txManager = new DefaultTransactionManager(db, config, logger);

await txManager.begin();
try {
  await db.execute('INSERT INTO users...');
  await db.execute('UPDATE accounts...');
  await txManager.commit(); // Automatic retry on failure
} catch (error) {
  await txManager.rollback(error);
  throw error;
}
```

### Example 2: With Hooks

```typescript
const hooks: ITransactionHooks = {
  onCommitRetry: async (context, attempt, error) => {
    console.log(`Retry ${attempt}: ${error.message}`);
  }
};

const txManager = new DefaultTransactionManager(db, config, logger, hooks);

await txManager.begin();
// ... operations
await txManager.commit(); // Hooks invoked on retry
```

### Example 3: Custom Transaction Manager

```typescript
const handler: IDatabaseMigrationHandler = {
  db: myDB,
  schemaVersion: mySchemaVersion,
  transactionManager: new CustomTransactionManager(myDB),
  getName: () => 'MyHandler',
  getVersion: () => '1.0.0'
};

const executor = new MigrationScriptExecutor(handler, config);
// Uses custom transaction manager instead of default
```

## Related Interfaces

- **[ITransactionalDB](./transactional-db.md)** - Database transaction interface
- **[ICallbackTransactionalDB](./db.md#icallbacktransactionaldb)** - Alternative transaction pattern (NoSQL)
- **[IDatabaseMigrationHandler](./database-handler.md)** - Handler interface with optional transaction manager
- **[ITransactionHooks](./db.md#itransactionhooks)** - Transaction lifecycle hooks
- **[ITransactionContext](./db.md#itransactioncontext)** - Context passed to hooks

## See Also

- [Transaction Management Guide](../../guides/transaction-management.md)
- [Transaction Configuration](../../configuration/transaction-settings.md)
- [Transaction Hooks](../../customization/hooks.md#transaction-hooks)
- [Custom Transaction Managers](../../customization/hooks.md#custom-transaction-managers)
