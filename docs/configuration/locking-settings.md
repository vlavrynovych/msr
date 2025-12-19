---
layout: default
title: Locking Settings
parent: Configuration
grand_parent: API Reference
nav_order: 6
---

# Locking Settings
{: .no_toc }

Configure migration locking to prevent concurrent execution
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Locking settings prevent multiple processes from running migrations simultaneously, which can cause:

- **Race Conditions**: Two processes applying the same migration
- **Corrupted State**: Migration tracking table with inconsistent data
- **Data Loss**: Conflicting schema changes applied out of order
- **Production Incidents**: Hard-to-debug issues from concurrent execution

MSR uses database-level locking similar to Knex.js and Liquibase, making it one of the few Node.js migration tools with built-in concurrency protection.

{: .tip }
> **Opt-In Feature (v0.8.0)**: Locking is disabled by default for backwards compatibility. Enable it by adding a `lockingService` to your handler. Once enabled, locking is active by default (recommended for production).

---

## config.locking

**Type:** `LockingConfig`
**Default:** `new LockingConfig()` (enabled with fail-fast defaults)

Configuration object for migration locking behavior.

```typescript
import { Config, LockingConfig } from '@migration-script-runner/core';

const config = new Config();

// Default: Enabled with fail-fast (recommended for production)
config.locking = new LockingConfig({
  enabled: true,
  timeout: 600_000,      // 10 minutes
  retryAttempts: 0,      // fail immediately
  retryDelay: 1000,      // 1 second (if retries enabled)
  tableName: 'migration_locks'
});
```

---

## locking.enabled

**Type:** `boolean`
**Default:** `true`

Whether migration locking is enabled.

```typescript
// Production: Keep enabled
config.locking.enabled = true;

// Development: Can disable for faster iteration
config.locking.enabled = false;

// CI/CD: Keep enabled to prevent parallel build issues
config.locking.enabled = true;
```

{: .warning }
> **Never disable in production**. Concurrent migrations can corrupt your database and cause production incidents.

---

## locking.timeout

**Type:** `number` (milliseconds)
**Default:** `600_000` (10 minutes)

Maximum time a lock can be held before automatic expiration.

```typescript
// Short migrations (< 1 min)
config.locking.timeout = 300_000;  // 5 minutes

// Medium migrations (1-5 min) - default
config.locking.timeout = 600_000;  // 10 minutes

// Long migrations (5-30 min)
config.locking.timeout = 1_800_000;  // 30 minutes

// Very long migrations
config.locking.timeout = 3_600_000;  // 1 hour (max recommended)
```

{: .tip }
> **Set timeout longer than your longest migration**. If a lock expires during a valid migration, you risk concurrent execution.

{: .warning }
> **Too long**: Stale locks take longer to auto-cleanup. **Too short**: Risk of lock expiring during valid migration.

---

## locking.retryAttempts

**Type:** `number`
**Default:** `0` (fail immediately)

Number of times to retry lock acquisition before failing.

```typescript
// Fail fast (default) - recommended for most cases
config.locking.retryAttempts = 0;

// Retry with patience
config.locking.retryAttempts = 5;  // Try 5 times

// Very patient
config.locking.retryAttempts = 10;  // Try 10 times
```

### When to Use Retries

**✅ Enable retries when:**
- Scheduled jobs that can wait
- Batch processing systems
- Non-critical automated deployments

**❌ Don't use retries when:**
- CI/CD pipelines (want fast feedback)
- Manual deployments (user is waiting)
- Critical production deployments

{: .tip }
> **Fail fast by default**. Immediate feedback is better than waiting. Use retries only for automated systems that can afford to wait.

---

## locking.retryDelay

**Type:** `number` (milliseconds)
**Default:** `1000` (1 second)

Delay between retry attempts (only used when `retryAttempts > 0`).

```typescript
config.locking.retryAttempts = 5;
config.locking.retryDelay = 2000;  // Wait 2 seconds between retries
// Total max wait: 5 × 2 seconds = 10 seconds
```

**Guidelines:**
- **Quick check**: 1000ms (1 second)
- **Standard**: 2000ms (2 seconds)
- **Polite**: 5000ms (5 seconds)

---

## locking.tableName

**Type:** `string`
**Default:** `'migration_locks'`

Database table name for storing locks.

```typescript
// Default
config.locking.tableName = 'migration_locks';

// Custom name
config.locking.tableName = 'app_migration_locks';

// Multiple MSR instances in same database
config.locking.tableName = 'app1_migration_locks';
```

{: .tip }
> **Multiple MSR instances**: Use different table names to allow multiple MSR instances to use the same database without lock conflicts.

---

## Configuration Patterns

### Production (Recommended)

Fail-fast with automatic cleanup:

```typescript
config.locking = new LockingConfig({
  enabled: true,
  timeout: 600_000,      // 10 minutes
  retryAttempts: 0,      // fail immediately
  retryDelay: 1000
});
```

**Why:**
- ✅ Immediate feedback if another migration is running
- ✅ Auto-cleanup after 10 minutes if process crashes
- ✅ No waiting in deployment pipelines

---

### Scheduled Jobs

Patient retry with longer timeout:

```typescript
config.locking = new LockingConfig({
  enabled: true,
  timeout: 1_800_000,    // 30 minutes
  retryAttempts: 10,     // retry 10 times
  retryDelay: 5000       // wait 5 seconds between retries
});
```

**Why:**
- ✅ Can wait up to 50 seconds for lock (10 × 5s)
- ✅ Longer timeout for scheduled migrations
- ✅ Better for automated systems

---

### Development

Disable for faster iteration:

```typescript
config.locking = new LockingConfig({
  enabled: false
});
```

**Why:**
- ✅ Faster local development workflow
- ✅ No lock conflicts during testing
- ⚠️ **NEVER use in production**

---

### CI/CD

Fail-fast with shorter timeout:

```typescript
config.locking = new LockingConfig({
  enabled: true,
  timeout: 300_000,      // 5 minutes
  retryAttempts: 0,      // fail immediately
  retryDelay: 1000
});
```

**Why:**
- ✅ Fast feedback if parallel builds conflict
- ✅ Prevents multiple CI jobs from running migrations
- ✅ Shorter timeout appropriate for CI migrations

---

## CLI Override

Disable locking for a single run:

```bash
# Temporarily disable locking
msr migrate --no-lock

# Check lock status
msr lock:status

# Force release stuck lock
msr lock:release --force
```

See [Lock Commands](/cli/lock-commands) for full CLI documentation.

---

## Lock Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Migration Start                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Generate ID   │
         │ host-pid-uuid │
         └───────┬───────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ Clean Expired Locks    │
    └────────┬───────────────┘
             │
             ▼
    ┌────────────────────┐          ┌──────────────┐
    │ Try Acquire Lock   │─────No──▶│ Retry?       │
    └────────┬───────────┘          └──────┬───────┘
             │Yes                          │Yes
             ▼                             │
    ┌────────────────────┐                │
    │ Verify Ownership   │◀───────────────┘
    └────────┬───────────┘
             │Valid
             ▼
    ┌────────────────────┐
    │ Run Migrations     │
    └────────┬───────────┘
             │
             ▼
    ┌────────────────────┐
    │ Release Lock       │
    │ (always, finally)  │
    └────────────────────┘
```

---

## Implementation Requirements

To use locking, your database handler must implement `ILockingService`:

```typescript
import { ILockingService, ILockStatus } from '@migration-script-runner/core';

class MyLockingService implements ILockingService<MyDB> {
  async acquireLock(executorId: string): Promise<boolean> {
    // Attempt to acquire lock using SELECT FOR UPDATE NOWAIT or equivalent
    // Return true if acquired, false if already locked
  }

  async releaseLock(executorId: string): Promise<void> {
    // Release lock held by this executor
  }

  async verifyLockOwnership(executorId: string): Promise<boolean> {
    // Verify this executor still owns the lock
    // Prevents race conditions
  }

  async getLockStatus(): Promise<ILockStatus | null> {
    // Return current lock information
  }

  async forceReleaseLock(): Promise<void> {
    // Unconditionally release any lock
    // Used by CLI lock:release command
  }

  async checkAndReleaseExpiredLock(): Promise<void> {
    // Clean up locks past their timeout
  }

  // NEW in v0.8.1: Required initialization methods
  async initLockStorage(): Promise<void> {
    // Create lock storage (tables, indexes, paths)
    // Example: CREATE TABLE IF NOT EXISTS migration_locks (...)
    // Throws on setup failures for fail-fast behavior
  }

  async ensureLockStorageAccessible(): Promise<boolean> {
    // Pre-flight check for storage accessibility
    // Returns true if accessible, false otherwise
    // Example: SELECT 1 FROM migration_locks LIMIT 1
  }
}

// Add to handler
handler.lockingService = new MyLockingService(handler.db);
```

{: .new }
> **NEW in v0.8.1:** The required `initLockStorage()` and `ensureLockStorageAccessible()` methods enable explicit lock storage setup and pre-flight validation. See examples below.

### Initialization Methods (v0.8.1+)

**Required lifecycle methods for explicit storage setup and validation.**

#### initLockStorage()

Creates lock storage structures (tables, collections, paths) before first use.

**When to Implement:**
- Database adapters requiring table/collection creation
- Adapters needing indexes or constraints
- File-based or cloud storage requiring path setup

**Benefits:**
- ✅ Fail-fast: Errors during setup, not during first lock
- ✅ Explicit: Clear when storage is initialized
- ✅ Testable: Can test setup separately from lock operations

**Example (PostgreSQL):**
```typescript
class PostgresLockingService implements ILockingService<IPostgresDB> {
  async initLockStorage(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS migration_locks (
        id SERIAL PRIMARY KEY,
        executor_id VARCHAR(255) UNIQUE NOT NULL,
        locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )
    `);

    // Create index for expired lock cleanup
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_migration_locks_expires_at
      ON migration_locks(expires_at)
    `);
  }
}
```

**Example (MongoDB):**
```typescript
class MongoLockingService implements ILockingService<IMongoDBInterface> {
  async initLockStorage(): Promise<void> {
    const db = this.db.client.db();

    // Create collection if needed
    const collections = await db.listCollections({ name: 'migration_locks' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('migration_locks');
    }

    // Create unique index on executor_id
    await db.collection('migration_locks').createIndex(
      { executor_id: 1 },
      { unique: true }
    );
  }
}
```

#### ensureLockStorageAccessible()

Verifies lock storage is accessible before attempting lock operations.

**When to Implement:**
- Pre-deployment validation in CI/CD
- Remote storage with network connectivity checks
- Permission validation

**Benefits:**
- ✅ Early detection of configuration issues
- ✅ Clear error messages before migrations start
- ✅ CI/CD validation without running migrations

**Example:**
```typescript
class PostgresLockingService implements ILockingService<IPostgresDB> {
  async ensureLockStorageAccessible(): Promise<boolean> {
    try {
      await this.db.query('SELECT 1 FROM migration_locks LIMIT 1');
      return true;
    } catch (error) {
      // Table doesn't exist or no permissions
      return false;
    }
  }
}
```

**Usage in Handler:**
```typescript
class MyHandler implements IDatabaseMigrationHandler<IDB> {
  async initialize(): Promise<void> {
    // Initialize lock storage
    if (this.lockingService) {
      await this.lockingService.initLockStorage();

      // Verify storage is accessible
      const accessible = await this.lockingService.ensureLockStorageAccessible();
      if (!accessible) {
        throw new Error('Lock storage not accessible. Check permissions and run initLockStorage().');
      }
    }
  }
}
```

See adapter-specific documentation for implementation examples.

---

## ILockingHooks Interface (v0.8.1)

**NEW in v0.8.1**: Lifecycle hooks for lock operations enable observability, metrics collection, alerting, and audit logging.

### Overview

`ILockingHooks` provides 9 optional hook methods that are called during lock lifecycle events. Use these hooks to:

- **Collect Metrics**: Track lock acquisition times, conflicts, and retry counts
- **Send Alerts**: Notify on-call teams via Slack/PagerDuty when lock conflicts occur
- **Audit Logging**: Record who acquired/released locks for compliance
- **Debugging**: Log detailed lock events during troubleshooting

### Interface Definition

```typescript
import { ILockingHooks, ILockStatus } from '@migration-script-runner/core';

interface ILockingHooks {
  // Before acquiring lock
  onBeforeAcquireLock?(executorId: string, timeout: number): Promise<void>;

  // After successfully acquiring and verifying lock
  onLockAcquired?(executorId: string, status: ILockStatus): Promise<void>;

  // When lock acquisition fails after all retries
  onLockAcquisitionFailed?(executorId: string, currentOwner: string): Promise<void>;

  // Before each retry attempt
  onAcquireRetry?(executorId: string, attempt: number, currentOwner: string): Promise<void>;

  // When ownership verification fails after acquisition
  onOwnershipVerificationFailed?(executorId: string): Promise<void>;

  // Before releasing lock
  onBeforeReleaseLock?(executorId: string): Promise<void>;

  // After successfully releasing lock
  onLockReleased?(executorId: string): Promise<void>;

  // When lock is force-released
  onForceReleaseLock?(status: ILockStatus | null): Promise<void>;

  // On any lock operation error
  onLockError?(operation: string, error: Error, executorId?: string): Promise<void>;
}
```

### Usage Example: Metrics Collection

```typescript
import { ILockingHooks, ILockStatus } from '@migration-script-runner/core';

class MetricsLockingHooks implements ILockingHooks {
  private metricsClient: MetricsClient;
  private startTime?: number;

  constructor(metricsClient: MetricsClient) {
    this.metricsClient = metricsClient;
  }

  async onBeforeAcquireLock(executorId: string, timeout: number): Promise<void> {
    this.startTime = Date.now();
    console.log(`[Metrics] Attempting to acquire lock: ${executorId}`);
  }

  async onLockAcquired(executorId: string, status: ILockStatus): Promise<void> {
    const duration = this.startTime ? Date.now() - this.startTime : 0;

    // Send metrics to DataDog/CloudWatch
    this.metricsClient.timing('migration.lock.acquired', duration);
    this.metricsClient.increment('migration.lock.success');

    console.log(`[Metrics] Lock acquired in ${duration}ms by ${executorId}`);
  }

  async onLockAcquisitionFailed(executorId: string, currentOwner: string): Promise<void> {
    // Track lock conflicts
    this.metricsClient.increment('migration.lock.conflict');
    this.metricsClient.tag('current_owner', currentOwner);

    console.error(`[Metrics] Lock conflict - held by ${currentOwner}`);
  }

  async onAcquireRetry(executorId: string, attempt: number, currentOwner: string): Promise<void> {
    this.metricsClient.increment('migration.lock.retry');
    console.log(`[Metrics] Lock retry #${attempt}, waiting for ${currentOwner}`);
  }

  async onLockError(operation: string, error: Error, executorId?: string): Promise<void> {
    this.metricsClient.increment('migration.lock.error');
    this.metricsClient.tag('operation', operation);
    console.error(`[Metrics] Lock error during ${operation}:`, error.message);
  }
}

// Usage
const hooks = new MetricsLockingHooks(myMetricsClient);
const handler = new MyHandler({
  lockingService: myLockingService,
  lockingHooks: hooks  // Pass hooks to handler
});
```

### Usage Example: Slack Alerts

```typescript
class SlackAlertHooks implements ILockingHooks {
  private slackWebhook: string;

  constructor(slackWebhook: string) {
    this.slackWebhook = slackWebhook;
  }

  async onLockAcquisitionFailed(executorId: string, currentOwner: string): Promise<void> {
    await this.sendSlackAlert({
      text: '⚠️ Migration Lock Conflict',
      attachments: [{
        color: 'warning',
        fields: [
          { title: 'Attempted By', value: executorId },
          { title: 'Currently Held By', value: currentOwner },
          { title: 'Action', value: 'Wait for lock release or force-release if stale' }
        ]
      }]
    });
  }

  async onLockError(operation: string, error: Error): Promise<void> {
    await this.sendSlackAlert({
      text: '🚨 Migration Lock Error',
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'Operation', value: operation },
          { title: 'Error', value: error.message }
        ]
      }]
    });
  }

  private async sendSlackAlert(payload: any): Promise<void> {
    await fetch(this.slackWebhook, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}
```

### Usage Example: Audit Logging

```typescript
class AuditLogHooks implements ILockingHooks {
  private auditLogger: Logger;

  constructor(auditLogger: Logger) {
    this.auditLogger = auditLogger;
  }

  async onLockAcquired(executorId: string, status: ILockStatus): Promise<void> {
    this.auditLogger.info({
      event: 'lock_acquired',
      executorId,
      timestamp: status.lockedAt,
      expiresAt: status.expiresAt
    });
  }

  async onLockReleased(executorId: string): Promise<void> {
    this.auditLogger.info({
      event: 'lock_released',
      executorId,
      timestamp: new Date()
    });
  }

  async onForceReleaseLock(status: ILockStatus | null): Promise<void> {
    this.auditLogger.warn({
      event: 'lock_force_released',
      previousOwner: status?.lockedBy,
      timestamp: new Date(),
      reason: 'manual_intervention'
    });
  }
}
```

### Integration with Handler

Hooks are automatically passed to `LockingOrchestrator` when provided to the handler:

```typescript
import { IDatabaseMigrationHandler, ILockingHooks } from '@migration-script-runner/core';

class MyHandler implements IDatabaseMigrationHandler<IDB> {
  lockingService?: ILockingService<IDB>;
  lockingHooks?: ILockingHooks;  // Add hooks property

  constructor(options: {
    lockingService?: ILockingService<IDB>;
    lockingHooks?: ILockingHooks;  // Accept hooks in constructor
  }) {
    this.lockingService = options.lockingService;
    this.lockingHooks = options.lockingHooks;
  }
}

// Create handler with hooks
const handler = new MyHandler({
  lockingService: new MyLockingService(db),
  lockingHooks: new MetricsLockingHooks(metricsClient)
});
```

{: .note }
> **Hook Failures**: Hook errors are logged but do not fail the migration. If a hook throws, the error is logged and execution continues.

---

## LockingOrchestrator Service (v0.8.1)

**NEW in v0.8.1**: Internal service that orchestrates lock operations with retry logic, hooks, and two-phase locking.

### Overview

`LockingOrchestrator` is an internal decorator service that wraps your `ILockingService` implementation. It handles:

- **Retry Logic**: Automatically retries lock acquisition with configurable attempts and delays
- **Two-Phase Locking**: Acquires lock then verifies ownership to prevent race conditions
- **Hook Invocation**: Calls lifecycle hooks at appropriate points
- **Error Handling**: Consistent error handling with context preservation
- **Logging**: Structured logging of all lock operations

### Architecture

MSR follows a **decorator pattern** for lock orchestration:

```
Your Handler
├── lockingService: ILockingService (adapter implementation)
│   └── Database-specific lock operations
└── lockingHooks?: ILockingHooks (optional hooks)

MigrationWorkflowOrchestrator (internal)
└── lockingOrchestrator: LockingOrchestrator
    ├── Wraps your lockingService
    ├── Applies retry logic
    ├── Invokes hooks
    └── Two-phase locking verification
```

**Key Design Principles:**

1. **Adapters Stay Simple**: Your `ILockingService` only implements database operations
2. **Core Handles Orchestration**: MSR core manages retry, hooks, and verification
3. **No Duplication**: Retry logic is centralized, not repeated in every adapter
4. **Consistent Behavior**: All databases get the same orchestration

### What It Does

#### 1. Retry Logic

```typescript
// Your code
const acquired = await executor.up();

// What LockingOrchestrator does internally:
for (let attempt = 1; attempt <= config.locking.retryAttempts; attempt++) {
  await hooks?.onBeforeAcquireLock?.(executorId, timeout);

  const acquired = await lockingService.acquireLock(executorId);
  if (acquired) {
    // Success - verify ownership
    const verified = await lockingService.verifyLockOwnership(executorId);
    if (verified) {
      await hooks?.onLockAcquired?.(executorId, status);
      return true;
    }
  }

  // Retry
  await hooks?.onAcquireRetry?.(executorId, attempt, currentOwner);
  await sleep(config.locking.retryDelay);
}

// Failed after all retries
await hooks?.onLockAcquisitionFailed?.(executorId, currentOwner);
return false;
```

#### 2. Two-Phase Locking

Prevents race conditions by verifying ownership after acquisition:

```typescript
// Phase 1: Acquire lock
const acquired = await lockingService.acquireLock(executorId);

// Phase 2: Verify ownership (catches race conditions)
const verified = await lockingService.verifyLockOwnership(executorId);

if (!verified) {
  await hooks?.onOwnershipVerificationFailed?.(executorId);
  throw new Error('Lock ownership verification failed');
}
```

This detects cases where:
- Two processes acquire lock simultaneously due to database timing
- Clock skew causes lock to expire immediately
- Another process force-released the lock

#### 3. Hook Invocation

Hooks are called at specific lifecycle points:

```typescript
// Before any operation
await hooks?.onBeforeAcquireLock?.(executorId, timeout);

// On success
await hooks?.onLockAcquired?.(executorId, status);

// On failure
await hooks?.onLockAcquisitionFailed?.(executorId, currentOwner);

// On retry
await hooks?.onAcquireRetry?.(executorId, attempt, currentOwner);

// On error
await hooks?.onLockError?.('acquire', error, executorId);
```

### Automatic Integration

You don't instantiate `LockingOrchestrator` directly. It's created automatically by `MigrationWorkflowOrchestrator` when your handler provides a `lockingService`:

```typescript
// In your handler
class MyHandler implements IDatabaseMigrationHandler<IDB> {
  lockingService = new MyLockingService(db);  // You provide this
  lockingHooks = new MetricsHooks();          // Optional
}

// MSR creates orchestrator internally
// MigrationWorkflowOrchestrator.constructor():
if (handler.lockingService) {
  this.lockingOrchestrator = new LockingOrchestrator(
    handler.lockingService,  // Your adapter
    config.locking,          // Retry config
    logger,                  // Logger
    handler.lockingHooks     // Optional hooks
  );
}
```

### Configuration

Configure retry behavior via `config.locking`:

```typescript
import { Config } from '@migration-script-runner/core';

const config = new Config();
config.locking.retryAttempts = 5;    // How many times to retry
config.locking.retryDelay = 1000;    // Wait 1000ms between retries
config.locking.timeout = 60000;      // Lock expires after 60 seconds
```

### Benefits for Adapters

**Before v0.8.1** (without LockingOrchestrator):
```typescript
// Every adapter had to implement retry logic
class MyLockingService implements ILockingService<IDB> {
  async acquireLock(executorId: string): Promise<boolean> {
    // Adapter must implement retry logic ❌
    // Adapter must implement hook calls ❌
    // Adapter must implement two-phase locking ❌
    // Code duplication across adapters ❌
  }
}
```

**After v0.8.1** (with LockingOrchestrator):
```typescript
// Adapters only implement database operations
class MyLockingService implements ILockingService<IDB> {
  async acquireLock(executorId: string): Promise<boolean> {
    // Pure database operation ✅
    const result = await this.db.transaction(/* ... */);
    return result.committed;
  }

  // No retry logic needed ✅
  // No hook calls needed ✅
  // Core handles orchestration ✅
}
```

### Error Handling

All errors are caught, logged, and hooks are invoked:

```typescript
try {
  await lockingService.acquireLock(executorId);
} catch (error) {
  logger.error(`Lock acquisition error: ${error}`);
  await hooks?.onLockError?.('acquire', error, executorId);
  throw error;  // Re-throw to fail migration
}
```

{: .important }
> **When Hooks Run**: Hooks run during lock operations but are optional. If a hook throws an error, it's logged but doesn't fail the migration.

---

## Troubleshooting

### Lock Stuck After Crash

If a process crashes, the lock expires automatically after `timeout` milliseconds. Or manually release:

```bash
# Check who holds the lock
msr lock:status

# Force release if you're sure it's stale
msr lock:release --force
```

### Lock Acquired But Ownership Verification Failed

This indicates a race condition or clock skew between servers. The lock was acquired but immediately lost. Possible causes:

- System clock differences between servers
- Database connection issues
- Extremely high concurrency

### Multiple MSR Instances Conflicting

Use different `tableName` for each instance:

```typescript
// App 1
config.locking.tableName = 'app1_migration_locks';

// App 2
config.locking.tableName = 'app2_migration_locks';
```
