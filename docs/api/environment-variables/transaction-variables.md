---
layout: default
title: Transaction Management
parent: Environment Variables
grand_parent: API Reference
nav_order: 5
---

# Transaction Environment Variables
{: .no_toc }

Environment variables for configuring transaction management, isolation levels, and automatic retry logic.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Transaction environment variables (introduced in v0.5.0) provide fine-grained control over transaction behavior during migration execution, including automatic retry logic for transient failures.

**Key Features:**
- Configurable transaction scope (per-migration, per-batch, none)
- SQL isolation level control
- Automatic retry with exponential backoff
- Transaction timeout configuration

---

## Configuration Approaches

### Dot-Notation (Recommended)

Configure individual properties:

```bash
export MSR_TRANSACTION_MODE=PER_MIGRATION
export MSR_TRANSACTION_ISOLATION=READ_COMMITTED
export MSR_TRANSACTION_TIMEOUT=30000
export MSR_TRANSACTION_RETRIES=3
export MSR_TRANSACTION_RETRY_DELAY=100
export MSR_TRANSACTION_RETRY_BACKOFF=true
```

### JSON Format

Configure all settings at once:

```bash
export MSR_TRANSACTION='{
  "mode": "PER_MIGRATION",
  "isolation": "READ_COMMITTED",
  "timeout": 30000,
  "retries": 3,
  "retryDelay": 100,
  "retryBackoff": true
}'
```

**Priority**: Dot-notation variables override JSON configuration.

---

## Variables

### MSR_TRANSACTION

**Complete transaction configuration as JSON**

- **Type**: `JSON object`
- **Default**: None
- **Since**: v0.5.0
- **Example**: See JSON Format above

Alternative to dot-notation variables. Provides complete transaction configuration in a single variable.

```bash
export MSR_TRANSACTION='{"mode":"PER_BATCH","isolation":"SERIALIZABLE","retries":5}'
```

**JSON Schema:**
```typescript
{
  mode?: 'PER_MIGRATION' | 'PER_BATCH' | 'NONE';
  isolation?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  timeout?: number;       // milliseconds
  retries?: number;       // retry attempts
  retryDelay?: number;    // milliseconds
  retryBackoff?: boolean; // exponential backoff
}
```

**Programmatic Equivalent:**
```typescript
config.transaction = {
  mode: TransactionMode.PER_MIGRATION,
  isolation: IsolationLevel.READ_COMMITTED,
  retries: 3
};
```

---

### MSR_TRANSACTION_MODE

**Transaction scope mode**

- **Type**: `string`
- **Values**: `PER_MIGRATION`, `PER_BATCH`, `NONE`
- **Default**: `PER_MIGRATION`
- **Since**: v0.5.0

Controls how migrations are wrapped in database transactions.

```bash
# Each migration in its own transaction (default)
export MSR_TRANSACTION_MODE=PER_MIGRATION

# All migrations in one transaction
export MSR_TRANSACTION_MODE=PER_BATCH

# No automatic transactions
export MSR_TRANSACTION_MODE=NONE
```

**Programmatic Equivalent:**
```typescript
import { TransactionMode } from '@migration-script-runner/core';
config.transaction.mode = TransactionMode.PER_MIGRATION;
```

**Mode Comparison:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| `PER_MIGRATION` | Each migration in own transaction | Standard migrations (90% of cases) |
| `PER_BATCH` | All migrations in single transaction | Tightly coupled changes |
| `NONE` | No automatic transactions | NoSQL, custom logic, long-running operations |

**Execution Flow:**

```bash
# PER_MIGRATION
BEGIN TRANSACTION
  Run Migration 1
COMMIT
BEGIN TRANSACTION
  Run Migration 2 (fails)
ROLLBACK
# Result: Migration 1 committed, Migration 2 rolled back

# PER_BATCH
BEGIN TRANSACTION
  Run Migration 1
  Run Migration 2 (fails)
ROLLBACK
# Result: All migrations rolled back

# NONE
Run Migration 1 (no transaction)
Run Migration 2 (no transaction)
# Result: Each migration manages its own transactions
```

**See Also:**
- [Transaction Settings](../../configuration/transaction-settings#transaction-modes)
- [Transaction Management Guide](../../guides/transaction-management)

---

### MSR_TRANSACTION_ISOLATION

**SQL transaction isolation level**

- **Type**: `string`
- **Values**: `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`
- **Default**: `READ_COMMITTED`
- **Since**: v0.5.0

Controls the SQL transaction isolation level for stronger or weaker consistency guarantees.

```bash
# Default (recommended)
export MSR_TRANSACTION_ISOLATION=READ_COMMITTED

# Strictest isolation
export MSR_TRANSACTION_ISOLATION=SERIALIZABLE

# Lowest isolation (highest performance)
export MSR_TRANSACTION_ISOLATION=READ_UNCOMMITTED
```

**Programmatic Equivalent:**
```typescript
import { IsolationLevel } from '@migration-script-runner/core';
config.transaction.isolation = IsolationLevel.READ_COMMITTED;
```

**Isolation Levels:**

| Level | Dirty Reads | Non-Repeatable Reads | Phantom Reads | Use Case |
|-------|-------------|----------------------|---------------|----------|
| `READ_UNCOMMITTED` | ❌ Allowed | ❌ Allowed | ❌ Allowed | High performance, non-critical data |
| `READ_COMMITTED` | ✅ Prevented | ❌ Allowed | ❌ Allowed | Standard use (default) |
| `REPEATABLE_READ` | ✅ Prevented | ✅ Prevented | ❌ Allowed | Consistent snapshots |
| `SERIALIZABLE` | ✅ Prevented | ✅ Prevented | ✅ Prevented | Critical consistency |

**Trade-offs:**
- **Higher isolation** = More consistency, less concurrency, higher chance of serialization failures
- **Lower isolation** = Better performance, less consistency, fewer conflicts

**See Also:**
- [Transaction Settings](../../configuration/transaction-settings#isolation-levels)

---

### MSR_TRANSACTION_TIMEOUT

**Transaction timeout in milliseconds**

- **Type**: `number`
- **Default**: `30000` (30 seconds)
- **Since**: v0.5.0
- **Example**: `10000`, `60000`, `120000`

Maximum time a transaction can run before being automatically rolled back.

```bash
# 30 seconds (default)
export MSR_TRANSACTION_TIMEOUT=30000

# 1 minute
export MSR_TRANSACTION_TIMEOUT=60000

# 2 minutes
export MSR_TRANSACTION_TIMEOUT=120000
```

**Programmatic Equivalent:**
```typescript
config.transaction.timeout = 30000;
```

**Recommendations:**

| Migration Type | Timeout | Reasoning |
|----------------|---------|-----------|
| Simple schema changes | 30s | Quick DDL operations |
| Complex migrations | 60-120s | Multiple operations |
| Data migrations | 300-600s | Large data processing |

**Note**: Long timeouts may cause lock contention. Consider breaking large migrations into smaller chunks.

---

### MSR_TRANSACTION_RETRIES

**Number of retry attempts on transient failures**

- **Type**: `number`
- **Default**: `3`
- **Since**: v0.5.0
- **Example**: `0`, `3`, `5`, `10`

Number of times to retry transaction commit on retriable errors (deadlocks, serialization failures).

```bash
# Default (recommended)
export MSR_TRANSACTION_RETRIES=3

# High-contention environment
export MSR_TRANSACTION_RETRIES=5

# No retries
export MSR_TRANSACTION_RETRIES=0
```

**Programmatic Equivalent:**
```typescript
config.transaction.retries = 3;
```

**Retriable Errors:**
- **Deadlocks**: `ER_LOCK_DEADLOCK`, `SQLITE_BUSY`
- **Serialization failures**: `40001`, `40P01`
- **Connection issues**: `ECONNRESET`, `ETIMEDOUT`

**Retry Behavior:**
```
Attempt 1: Immediate execution
Attempt 2: Wait retryDelay (100ms default)
Attempt 3: Wait retryDelay * 2 (if backoff enabled)
Attempt 4: Wait retryDelay * 4 (if backoff enabled)
```

**See Also:**
- [Transaction Settings](../../configuration/transaction-settings#retry-configuration)

---

### MSR_TRANSACTION_RETRY_DELAY

**Initial delay between retries in milliseconds**

- **Type**: `number`
- **Default**: `100`
- **Since**: v0.5.0
- **Example**: `50`, `100`, `200`, `500`

Base delay before retrying a failed transaction. With exponential backoff enabled, subsequent delays double.

```bash
# 100ms (default)
export MSR_TRANSACTION_RETRY_DELAY=100

# 200ms for high-contention
export MSR_TRANSACTION_RETRY_DELAY=200

# 50ms for fast retries
export MSR_TRANSACTION_RETRY_DELAY=50
```

**Programmatic Equivalent:**
```typescript
config.transaction.retryDelay = 100;
```

**Delay Patterns:**

With `retryBackoff=true` (default):
```
Attempt 1: Immediate
Attempt 2: Wait 100ms
Attempt 3: Wait 200ms
Attempt 4: Wait 400ms
```

With `retryBackoff=false`:
```
Attempt 1: Immediate
Attempt 2: Wait 100ms
Attempt 3: Wait 100ms
Attempt 4: Wait 100ms
```

**Recommendations:**

| Environment | Delay | Reasoning |
|-------------|-------|-----------|
| Development | 50ms | Fast feedback |
| Production | 100-200ms | Balance between speed and contention |
| High-contention | 200-500ms | Reduce retry storms |

---

### MSR_TRANSACTION_RETRY_BACKOFF

**Enable exponential backoff for retries**

- **Type**: `boolean`
- **Default**: `true`
- **Since**: v0.5.0

Controls whether retry delays use exponential backoff (doubling) or constant delay.

```bash
# Exponential backoff (default, recommended)
export MSR_TRANSACTION_RETRY_BACKOFF=true

# Constant delay
export MSR_TRANSACTION_RETRY_BACKOFF=false
```

**Programmatic Equivalent:**
```typescript
config.transaction.retryBackoff = true;
```

**Comparison:**

| Backoff | Retry Pattern | Use Case |
|---------|---------------|----------|
| `true` (default) | 100ms → 200ms → 400ms | Production (reduces contention) |
| `false` | 100ms → 100ms → 100ms | Development, testing |

**Benefits of Exponential Backoff:**
- ✅ Reduces retry storms under high load
- ✅ Gives contended resources time to clear
- ✅ Industry best practice for distributed systems

**See Also:**
- [Retry Configuration](../../configuration/transaction-settings#retry-configuration)

---

## Complete Examples

### Standard Application (Default)

Recommended settings for most applications:

```bash
export MSR_TRANSACTION_MODE=PER_MIGRATION
export MSR_TRANSACTION_ISOLATION=READ_COMMITTED
export MSR_TRANSACTION_TIMEOUT=30000
export MSR_TRANSACTION_RETRIES=3
export MSR_TRANSACTION_RETRY_DELAY=100
export MSR_TRANSACTION_RETRY_BACKOFF=true
```

### High-Contention Production

Optimized for databases with high concurrent load:

```bash
export MSR_TRANSACTION_MODE=PER_MIGRATION
export MSR_TRANSACTION_ISOLATION=READ_COMMITTED
export MSR_TRANSACTION_TIMEOUT=60000
export MSR_TRANSACTION_RETRIES=5
export MSR_TRANSACTION_RETRY_DELAY=200
export MSR_TRANSACTION_RETRY_BACKOFF=true
```

### Critical Data with Serializable Isolation

Maximum consistency guarantees:

```bash
export MSR_TRANSACTION_MODE=PER_BATCH
export MSR_TRANSACTION_ISOLATION=SERIALIZABLE
export MSR_TRANSACTION_TIMEOUT=60000
export MSR_TRANSACTION_RETRIES=5
export MSR_TRANSACTION_RETRY_DELAY=200
export MSR_TRANSACTION_RETRY_BACKOFF=true
```

### NoSQL or Custom Transactions

No automatic transaction management:

```bash
export MSR_TRANSACTION_MODE=NONE
```

### Development Environment

Fast feedback with minimal retries:

```bash
export MSR_TRANSACTION_MODE=PER_MIGRATION
export MSR_TRANSACTION_ISOLATION=READ_COMMITTED
export MSR_TRANSACTION_TIMEOUT=30000
export MSR_TRANSACTION_RETRIES=1
export MSR_TRANSACTION_RETRY_DELAY=50
export MSR_TRANSACTION_RETRY_BACKOFF=false
```

### Docker Configuration

```dockerfile
ENV MSR_TRANSACTION_MODE=PER_MIGRATION \
    MSR_TRANSACTION_ISOLATION=READ_COMMITTED \
    MSR_TRANSACTION_TIMEOUT=30000 \
    MSR_TRANSACTION_RETRIES=3 \
    MSR_TRANSACTION_RETRY_DELAY=100 \
    MSR_TRANSACTION_RETRY_BACKOFF=true
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: msr-transaction-config
data:
  MSR_TRANSACTION_MODE: "PER_MIGRATION"
  MSR_TRANSACTION_ISOLATION: "READ_COMMITTED"
  MSR_TRANSACTION_TIMEOUT: "30000"
  MSR_TRANSACTION_RETRIES: "5"
  MSR_TRANSACTION_RETRY_DELAY: "200"
  MSR_TRANSACTION_RETRY_BACKOFF: "true"
```

### Using JSON Format

Complete configuration in single variable:

```bash
export MSR_TRANSACTION='{
  "mode": "PER_MIGRATION",
  "isolation": "READ_COMMITTED",
  "timeout": 30000,
  "retries": 3,
  "retryDelay": 100,
  "retryBackoff": true
}'
```

---

## Decision Guide

### Choose Transaction Mode

**When to use PER_MIGRATION (default):**
- ✅ Standard migrations with independent changes
- ✅ Need partial progress on failure
- ✅ 90% of use cases

**When to use PER_BATCH:**
- ✅ Tightly coupled migrations must all succeed together
- ✅ All-or-nothing semantics required
- ✅ Related schema changes (table + indexes + constraints)

**When to use NONE:**
- ✅ NoSQL databases without transaction support
- ✅ Long-running data migrations
- ✅ Custom transaction logic in migration scripts
- ✅ DDL operations that can't run in transactions

### Choose Isolation Level

**When to use READ_COMMITTED (default):**
- ✅ Standard applications
- ✅ Good balance of consistency and performance
- ✅ Most common choice

**When to use SERIALIZABLE:**
- ✅ Critical data integrity requirements
- ✅ Can tolerate serialization failures and retries
- ✅ Financial or audit-critical operations

**When to use READ_UNCOMMITTED:**
- ❌ Rarely recommended
- ⚠️ Only for non-critical read-heavy workloads

### Configure Retries

**Standard (recommended):**
```bash
MSR_TRANSACTION_RETRIES=3
MSR_TRANSACTION_RETRY_DELAY=100
MSR_TRANSACTION_RETRY_BACKOFF=true
```

**High-contention:**
```bash
MSR_TRANSACTION_RETRIES=5
MSR_TRANSACTION_RETRY_DELAY=200
MSR_TRANSACTION_RETRY_BACKOFF=true
```

**Development:**
```bash
MSR_TRANSACTION_RETRIES=1
MSR_TRANSACTION_RETRY_DELAY=50
MSR_TRANSACTION_RETRY_BACKOFF=false
```

---

## Related Documentation

- **[Environment Variables Index](index)** - All environment variables
- **[Transaction Settings](../../configuration/transaction-settings)** - Complete configuration
- **[Transaction Management Guide](../../guides/transaction-management)** - Usage guide
- **[ITransactionalDB Interface](../interfaces/transactional-db)** - Database interface
- **[ITransactionManager Interface](../interfaces/transaction-manager)** - Transaction manager

---

## Source Code

TypeScript enum definition: [`src/model/env/TransactionEnvVars.ts`](../../../src/model/env/TransactionEnvVars.ts)
