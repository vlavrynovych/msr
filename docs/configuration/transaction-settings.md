---
layout: default
title: Transaction Settings
parent: Configuration
nav_order: 5
---

# Transaction Settings
{: .no_toc }

Configure transaction management for migration execution. Transaction settings control how migrations are wrapped in database transactions and how they behave on failure.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

- [Overview](#overview)
- [Transaction Configuration](#transaction-configuration)
- [Transaction Modes](#transaction-modes)
- [Isolation Levels](#isolation-levels)
- [Retry Configuration](#retry-configuration)
- [Configuration Examples](#configuration-examples)
- [Environment Variables](#environment-variables)

## Overview

Transaction management provides fine-grained control over transaction boundaries during migration execution. You can configure whether migrations run in individual transactions, as a batch, or without automatic transactions.

**Key Benefits:**
- **Atomicity**: Ensure migrations succeed or fail as a unit
- **Consistency**: Maintain database consistency across migrations
- **Resilience**: Automatic retry on transient failures (deadlocks, serialization errors)
- **Flexibility**: Choose transaction scope based on your needs

## Transaction Configuration

The `transaction` property on the `Config` class controls all transaction-related settings:

```typescript
import { Config, TransactionMode, IsolationLevel } from '@migration-script-runner/core';

const config = new Config();
config.transaction = {
  mode: TransactionMode.PER_MIGRATION,
  isolation: IsolationLevel.READ_COMMITTED,
  timeout: 30000,
  retries: 3,
  retryDelay: 100,
  retryBackoff: true
};
```

### Transaction Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `mode` | `TransactionMode` | `PER_MIGRATION` | Transaction boundary scope |
| `isolation` | `IsolationLevel` | `READ_COMMITTED` | SQL transaction isolation level |
| `timeout` | `number` | `30000` | Transaction timeout in milliseconds |
| `retries` | `number` | `3` | Number of retry attempts for transient failures |
| `retryDelay` | `number` | `100` | Base delay between retries in milliseconds |
| `retryBackoff` | `boolean` | `true` | Use exponential backoff for retries |

## Transaction Modes

### PER_MIGRATION (Default)

Each migration runs in its own transaction. If a migration fails, only that migration is rolled back. Previously successful migrations remain committed.

**Use Cases:**
- Standard migrations with independent changes
- Most common scenario (90% of use cases)
- Maximum safety and isolation

**Example:**
```typescript
config.transaction.mode = TransactionMode.PER_MIGRATION;

// Execution:
// BEGIN TRANSACTION
//   Run Migration 1
// COMMIT
// BEGIN TRANSACTION
//   Run Migration 2 (fails)
// ROLLBACK
// Result: Migration 1 committed, Migration 2 rolled back
```

**Pros:**
- ✅ Independent migrations
- ✅ Partial progress on failure
- ✅ Easy to resume from failure

**Cons:**
- ❌ Cannot rollback previous migrations automatically
- ❌ Tightly coupled migrations need coordination

### PER_BATCH

All migrations in a batch run in a single transaction. If any migration fails, the entire batch is rolled back.

**Use Cases:**
- Tightly coupled migrations that must all succeed together
- All-or-nothing semantics required
- Related schema changes (e.g., table + indexes + constraints)

**Example:**
```typescript
config.transaction.mode = TransactionMode.PER_BATCH;

// Execution:
// BEGIN TRANSACTION
//   Run Migration 1
//   Run Migration 2
//   Run Migration 3 (fails)
// ROLLBACK
// Result: All migrations rolled back
```

**Pros:**
- ✅ All-or-nothing consistency
- ✅ Tightly coupled migrations stay together
- ✅ Single atomic operation

**Cons:**
- ❌ All-or-nothing (no partial progress)
- ❌ Long transactions may cause locks
- ❌ Higher risk of timeouts

### NONE

No automatic transaction management. Migration scripts manage transactions themselves or run without transactions.

**Use Cases:**
- Databases without transaction support (some NoSQL)
- Long-running operations (data migrations)
- Custom transaction logic in migration scripts
- DDL operations that can't run in transactions (some databases)

**Example:**
```typescript
config.transaction.mode = TransactionMode.NONE;

// Execution:
// Run Migration 1 (no transaction)
// Run Migration 2 (no transaction)
// Run Migration 3 (no transaction)
// Result: Each migration manages its own transactions or runs without
```

**Pros:**
- ✅ Maximum flexibility
- ✅ Works with any database
- ✅ Custom transaction boundaries in scripts

**Cons:**
- ❌ Manual transaction management required
- ❌ No automatic rollback
- ❌ Advanced use case only

## Isolation Levels

Control the SQL transaction isolation level for migrations. Higher isolation levels provide stronger consistency guarantees but may impact performance.

### Available Isolation Levels

| Level | Description | Use Cases |
|-------|-------------|-----------|
| `READ_UNCOMMITTED` | Lowest isolation, allows dirty reads | High performance, non-critical data |
| `READ_COMMITTED` | Default, prevents dirty reads | Standard use case (recommended) |
| `REPEATABLE_READ` | Prevents non-repeatable reads | Consistent snapshots needed |
| `SERIALIZABLE` | Highest isolation, full serializability | Critical consistency requirements |

**Example:**
```typescript
import { IsolationLevel } from '@migration-script-runner/core';

// Default (recommended for most cases)
config.transaction.isolation = IsolationLevel.READ_COMMITTED;

// Higher isolation for critical migrations
config.transaction.isolation = IsolationLevel.SERIALIZABLE;
```

### Isolation Level Behavior

```typescript
// READ_COMMITTED (default)
config.transaction.isolation = IsolationLevel.READ_COMMITTED;
// - Prevents dirty reads
// - Allows non-repeatable reads
// - Good balance of consistency and performance

// SERIALIZABLE (strictest)
config.transaction.isolation = IsolationLevel.SERIALIZABLE;
// - Full serializability guarantees
// - Higher chance of serialization failures (automatic retry)
// - Use for critical data integrity requirements
```

## Retry Configuration

Transaction failures can occur due to transient issues like deadlocks or serialization conflicts. The retry system automatically retries failed commits with configurable backoff.

### Retriable Errors

The system automatically detects and retries these errors:
- **Deadlocks**: `ER_LOCK_DEADLOCK`, `SQLITE_BUSY`
- **Serialization failures**: `40001`, `40P01`
- **Connection issues**: `ECONNRESET`, `ETIMEDOUT`

### Retry Settings

```typescript
config.transaction.retries = 3;         // Number of retry attempts
config.transaction.retryDelay = 100;    // Base delay in milliseconds
config.transaction.retryBackoff = true; // Exponential backoff enabled
```

### Retry Behavior

**With Exponential Backoff (default):**
```
Attempt 1: Immediate
Attempt 2: Wait 100ms
Attempt 3: Wait 200ms
Attempt 4: Wait 400ms
```

**Without Exponential Backoff:**
```
Attempt 1: Immediate
Attempt 2: Wait 100ms
Attempt 3: Wait 100ms
Attempt 4: Wait 100ms
```

**Example:**
```typescript
// Production-ready settings (default)
config.transaction.retries = 3;
config.transaction.retryDelay = 100;
config.transaction.retryBackoff = true;

// High-contention environments
config.transaction.retries = 5;
config.transaction.retryDelay = 200;
config.transaction.retryBackoff = true;

// Disable retries (not recommended)
config.transaction.retries = 0;
```

## Configuration Examples

### Example 1: Standard Application (Default)

```typescript
import { Config, TransactionMode, IsolationLevel } from '@migration-script-runner/core';

const config = new Config();
config.transaction.mode = TransactionMode.PER_MIGRATION;
config.transaction.isolation = IsolationLevel.READ_COMMITTED;
config.transaction.retries = 3;

// Each migration in its own transaction
// Standard isolation level
// Automatic retry on deadlocks
```

### Example 2: Batch Migrations with High Isolation

```typescript
const config = new Config();
config.transaction.mode = TransactionMode.PER_BATCH;
config.transaction.isolation = IsolationLevel.SERIALIZABLE;
config.transaction.timeout = 60000; // 1 minute timeout
config.transaction.retries = 5;     // More retries for serialization failures

// All migrations in single transaction
// Strictest isolation for critical data
// Extended timeout for batch operation
```

### Example 3: NoSQL or Custom Transactions

```typescript
const config = new Config();
config.transaction.mode = TransactionMode.NONE;

// No automatic transactions
// Migration scripts manage their own transactions
// Useful for MongoDB, Cassandra, or custom logic
```

### Example 4: High-Concurrency Production

```typescript
const config = new Config();
config.transaction.mode = TransactionMode.PER_MIGRATION;
config.transaction.isolation = IsolationLevel.READ_COMMITTED;
config.transaction.retries = 5;
config.transaction.retryDelay = 200;
config.transaction.retryBackoff = true;

// Optimized for high-contention environments
// More retries with longer delays
// Exponential backoff to reduce contention
```

## Environment Variables

All transaction settings can be configured via environment variables:

```bash
# Transaction mode
MSR_TRANSACTION_MODE=PER_MIGRATION  # or PER_BATCH, NONE

# Isolation level
MSR_TRANSACTION_ISOLATION=READ_COMMITTED  # or READ_UNCOMMITTED, REPEATABLE_READ, SERIALIZABLE

# Timeout (milliseconds)
MSR_TRANSACTION_TIMEOUT=30000

# Retry settings
MSR_TRANSACTION_RETRIES=3
MSR_TRANSACTION_RETRY_DELAY=100
MSR_TRANSACTION_RETRY_BACKOFF=true
```

Environment variables override default values but are overridden by programmatic configuration:

```typescript
// Priority (highest to lowest):
// 1. Programmatic config.transaction.mode = TransactionMode.PER_BATCH
// 2. Environment variable MSR_TRANSACTION_MODE=PER_MIGRATION
// 3. Default value TransactionMode.PER_MIGRATION
```

## Related Documentation

- **[Transaction Management Guide](../user-guides/transaction-management.md)** - Comprehensive guide with examples
- **[ITransactionalDB Interface](../api/interfaces/transactional-db.md)** - Database transaction interface
- **[ITransactionManager Interface](../api/interfaces/transaction-manager.md)** - Transaction manager API
- **[Environment Variables Reference](../api/environment-variables/)** - All environment variables
- **[Rollback Settings](./rollback-settings.md)** - Rollback strategy configuration
- **[Configuration Index](./index.md)** - All configuration options

## See Also

- [Transaction Management User Guide](../user-guides/transaction-management.md)
- [Hooks Documentation](../customization/hooks.md) - Transaction lifecycle hooks
- [Dry Run Mode](../user-guides/testing-migrations.md) - Testing with transactions
