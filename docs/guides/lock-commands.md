---
layout: default
title: Lock Commands
parent: Guides
nav_order: 10
---

# Lock Commands
{: .no_toc }

Manage migration locks to prevent concurrent execution and recover from stuck locks
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR provides two lock management commands to help you:
- **Check lock status**: See who holds the migration lock
- **Release stuck locks**: Recover from crashed processes

These commands work with the [locking mechanism](/configuration/locking-settings) to prevent concurrent migrations.

---

## lock:status

Display the current migration lock status.

### Usage

```bash
msr lock:status
```

### Outputs

#### No Lock (Unlocked)

```bash
$ msr lock:status

Lock Status: UNLOCKED
No migration is currently running.
```

#### Lock Held

```bash
$ msr lock:status

Lock Status: LOCKED
Locked by: macbook-pro-12345-a1b2c3d4-e5f6-7890-abcd
Locked at: 2025-12-18T14:32:10.123Z
Expires at: 2025-12-18T14:42:10.123Z
Process ID: 12345

Another migration is currently running.
If you believe this is a stale lock, use: msr lock:release --force
```

#### Locking Not Configured

```bash
$ msr lock:status

Lock Status: NOT CONFIGURED
Locking service is not available in your database handler.
See documentation for implementing ILockingService.
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (lock status retrieved) |
| 1 | Error (unable to check status) |

---

## lock:release

Force-release a stuck migration lock.

{: .warning }
> **⚠️ DANGEROUS OPERATION**: Only use when you're CERTAIN no migration is running. Releasing an active lock can corrupt your database.

### Usage

```bash
msr lock:release --force
```

### Required Flag

The `--force` flag is **required** for safety. This ensures you don't accidentally release a lock.

```bash
# ❌ This will fail
$ msr lock:release
✗ Error: --force flag is required for safety

# ✅ This will work
$ msr lock:release --force
```

### Interactive Confirmation

When releasing a lock, MSR shows details and asks for confirmation:

```bash
$ msr lock:release --force

⚠️  WARNING: Force releasing migration lock
──────────────────────────────────────────────────────
Lock held by: macbook-pro-12345-a1b2c3d4-e5f6-7890-abcd
Locked at: 2025-12-18T14:32:10.123Z
Expires at: 2025-12-18T14:42:10.123Z
──────────────────────────────────────────────────────

Releasing this lock while a migration is running could cause:
  • Race conditions
  • Corrupted migration state
  • Data loss

Only proceed if you are CERTAIN the migration process has crashed.

Are you sure you want to release this lock? (y/N): _
```

### Response Options

```bash
# Cancel (default)
Are you sure you want to release this lock? (y/N): n

✓ Operation cancelled
```

```bash
# Proceed
Are you sure you want to release this lock? (y/N): y

✓ Lock forcibly released
You can now run migrations again.
```

### No Lock to Release

```bash
$ msr lock:release --force

✓ No lock to release
The lock is already released or was never acquired.
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (lock released or no lock to release) |
| 1 | Error (unable to release lock) |

---

## Common Workflows

### 1. Check Before Releasing

Always check the lock status before releasing:

```bash
# Step 1: Check who holds the lock
$ msr lock:status

Lock Status: LOCKED
Locked by: server-prod-01-12345-uuid
Locked at: 2025-12-18T14:32:10.123Z
Expires at: 2025-12-18T14:42:10.123Z

# Step 2: Verify the process is truly stuck
# - Check if server-prod-01 crashed
# - Check if migration is still running
# - Check if lock is expired

# Step 3: Only release if you're sure it's stale
$ msr lock:release --force
```

---

### 2. Recovery from Crashed Process

When a migration process crashes:

```bash
# The lock remains until timeout (default: 10 minutes)
$ msr lock:status

Lock Status: LOCKED
Locked by: crashed-process-uuid
Locked at: 2025-12-18T14:30:00.000Z
Expires at: 2025-12-18T14:40:00.000Z  # Still 5 minutes away

# Option 1: Wait for automatic expiration
# The lock will auto-expire after timeout

# Option 2: Manually release if urgent
$ msr lock:release --force
```

---

### 3. CI/CD Pipeline Stuck

When a CI/CD pipeline gets stuck:

```bash
# Check if lock is from abandoned CI job
$ msr lock:status

Lock Status: LOCKED
Locked by: ci-runner-5-12345-uuid
Locked at: 2025-12-18T14:00:00.000Z  # 1 hour ago!
Expires at: 2025-12-18T14:10:00.000Z  # Already expired!

# Release the expired lock
$ msr lock:release --force
```

{: .tip }
> **Expired locks**: Even if a lock is past its expiration time, it must be manually released. The expiration is checked during lock acquisition, not continuously.

---

### 4. Disable Locking for Emergency

If locking is causing issues during an incident:

```bash
# Option 1: Disable for single run
$ msr migrate --no-lock

# Option 2: Force release and run normally
$ msr lock:release --force
$ msr migrate
```

{: .warning }
> Only disable locking during emergencies. Always re-enable it after resolving the issue.

---

## Troubleshooting

### "Lock ownership verification failed"

**Symptom**: Lock was acquired but immediately lost.

**Causes**:
- System clock differences between servers
- Database connection issues
- Extremely high concurrency

**Solution**:
1. Check system clocks are synchronized (NTP)
2. Verify database connectivity is stable
3. Check for competing migration processes

---

### Lock Always Held

**Symptom**: `msr lock:status` always shows lock held, even after releasing.

**Possible causes**:
- Another process continuously acquires the lock
- Multiple MSR instances configured incorrectly

**Solution**:
```bash
# Check if multiple processes are running
$ ps aux | grep msr

# Use different table names for different apps
# In config:
config.locking.tableName = 'app1_migration_locks';  // App 1
config.locking.tableName = 'app2_migration_locks';  // App 2
```

---

### Can't Release Lock

**Symptom**: `msr lock:release --force` fails with database error.

**Possible causes**:
- Database connection issues
- Permission problems
- Lock table doesn't exist

**Solution**:
```bash
# Check database connectivity
$ msr list  # If this works, database is accessible

# Check lock table exists (SQL example)
$ psql -c "SELECT * FROM migration_locks;"

# Manually delete lock (DANGEROUS - use only as last resort)
$ psql -c "DELETE FROM migration_locks;"
```

---

## Integration with Monitoring

### Prometheus Metrics

Monitor lock status in your monitoring system:

```bash
#!/bin/bash
# check-lock-status.sh
# Returns 0 if unlocked, 1 if locked

msr lock:status | grep -q "UNLOCKED"
exit $?
```

---

### Alerting

Set up alerts for long-held locks:

```bash
#!/bin/bash
# alert-stale-lock.sh
# Alert if lock is held longer than expected

OUTPUT=$(msr lock:status)

if echo "$OUTPUT" | grep -q "LOCKED"; then
  LOCKED_AT=$(echo "$OUTPUT" | grep "Locked at:" | cut -d: -f2-)
  # Calculate duration and alert if > threshold
  # (implementation depends on your alerting system)
fi
```

---

## API Alternative

For programmatic access, use the API:

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor({ handler, config });

// Check lock status
const status = await executor.getLockStatus();
if (status?.isLocked) {
  console.log(`Lock held by: ${status.lockedBy}`);
  console.log(`Expires at: ${status.expiresAt}`);
}

// Force release lock
await executor.forceReleaseLock();
```

See [API Documentation](/api) for details.

---

## Related

- [Locking Settings](/configuration/locking-settings) - Configure locking behavior
- [CLI vs API](/guides/cli-vs-api) - When to use CLI vs API
- [Transaction Settings](/configuration/transaction-settings) - Transaction configuration
- [Troubleshooting](/guides/troubleshooting) - Common issues and solutions
