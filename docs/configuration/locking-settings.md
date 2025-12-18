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
}

// Add to handler
handler.lockingService = new MyLockingService(handler.db);
```

See adapter-specific documentation for implementation examples.

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
