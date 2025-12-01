---
layout: default
title: Version Control
parent: Guides
nav_order: 4
---

# Version Control Guide
{: .no_toc }

Learn how to use MSR's version control features for controlled migrations and rollbacks.
{: .fs-6 .fw-300 }

## What You'll Learn

- Migrating to specific database versions with up(targetVersion)
- Rolling back to previous versions with down(targetVersion)
- Staged deployment strategies
- Emergency rollback procedures
- Version control best practices

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR supports controlled migration to specific database versions through the `up(targetVersion)` and `down(targetVersion)` methods. This enables:

- **Staged Deployments** - Deploy migrations incrementally in production
- **Testing** - Test specific migration versions before full deployment
- **Rollback** - Return database to a previous version when issues arise
- **Blue-Green Deployments** - Maintain version parity across environments

{: .tip }
> Version control methods give you fine-grained control over database state, perfect for canary deployments, A/B testing, and gradual rollouts.

---

## Migrating to a Specific Version

The `up(targetVersion)` method executes all pending migrations up to and including a specific target version.

### Basic Usage

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';

const config = new Config();
const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler, config);

// Migrate to specific version
const targetVersion = 202501220300;
const result = await executor.up(targetVersion);

if (result.success) {
  console.log(`✅ Database migrated to version ${targetVersion}`);
  console.log(`Executed ${result.executed.length} migrations`);
} else {
  console.error('❌ Migration failed:', result.errors);
  process.exit(1);
}
```

### How It Works

1. **Scans** all available migration files in the configured folder
2. **Filters** to only migrations with timestamp <= targetVersion
3. **Excludes** migrations already executed (from schema_version table)
4. **Executes** remaining migrations in chronological order
5. **Saves** each migration to schema_version table immediately after execution
6. **Returns** structured result with success status and executed migrations

### Early Return

If the database is already at or beyond the target version, `up()` returns early without executing any migrations:

```typescript
// Database already at version 202501220300 or higher
const result = await executor.up(202501220300);

console.log(result.executed.length); // 0 - no migrations executed
console.log(result.success);         // true
```

---

## Rolling Back to a Specific Version

The `down(targetVersion)` method rolls back migrations newer than the target version by executing their `down()` methods in reverse chronological order.

### Basic Usage

```typescript
// Roll back to version 202501220100
const targetVersion = 202501220100;
const result = await executor.down(targetVersion);

if (result.success) {
  console.log(`✅ Rolled back to version ${targetVersion}`);
  console.log(`Rolled back ${result.executed.length} migrations`);
} else {
  console.error('❌ Rollback failed:', result.errors);
  process.exit(1);
}
```

### How It Works

1. **Scans** current database state from schema_version table
2. **Filters** to only migrations with timestamp > targetVersion
3. **Sorts** in reverse chronological order (newest first)
4. **Initializes** each migration script file
5. **Validates** that each migration has a `down()` method (throws error if missing)
6. **Executes** `down()` method for each migration
7. **Removes** migration record from schema_version table after successful rollback
8. **Returns** structured result with success status

### Requirements

All migrations being rolled back **must** implement the `down()` method:

```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

export default class AddUsersTable implements IRunnableScript {
  async up(db: IDB, info: IMigrationInfo): Promise<string> {
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created';
  }

  // Required for down() to work
  async down(db: IDB, info: IMigrationInfo): Promise<string> {
    await db.query('DROP TABLE IF EXISTS users');
    return 'Users table dropped';
  }
}
```

If any migration is missing a `down()` method, `down()` will throw an error and stop:

```typescript
Error: Cannot rollback migration V202501220100_add_users: down() method not implemented
```

{: .warning }
> All migrations being rolled back MUST implement `down()` methods. If you plan to use `down()`, always write `down()` methods for your migrations.

---

## Use Cases

### Staged Production Deployment

Deploy migrations in controlled batches with monitoring between stages:

```typescript
// Week 1: Deploy first batch
const result1 = await executor.up(202501220300);
console.log(`Deployed ${result1.executed.length} migrations`);

// Monitor for issues, collect metrics
await monitorForWeek();

// Week 2: Deploy second batch
const result2 = await executor.up(202501290500);
console.log(`Deployed ${result2.executed.length} more migrations`);
```

### Emergency Rollback

Quickly rollback to a known-good version when issues are detected:

```typescript
// Production is at version 202501290500
// Issue detected in latest migrations
// Roll back to previous stable version

const result = await executor.down(202501220300);

if (result.success) {
  console.log('✅ Emergency rollback complete');
  await notifyTeam('Rolled back to version 202501220300');
} else {
  console.error('❌ Rollback failed - manual intervention required');
  await alertOncall(result.errors);
}
```

### Testing Migrations

Test migrations up to specific versions before full deployment:

```typescript
// Test environment: apply migrations up to version under test
await executor.up(202501220300);

// Run integration tests
const testResults = await runIntegrationTests();

if (testResults.pass) {
  console.log('✅ Tests passed - safe to deploy to production');
} else {
  // Roll back and fix issues
  await executor.down(0);
  console.log('❌ Tests failed - migrations rolled back');
}
```

### Blue-Green Deployment

Maintain version parity between blue and green environments:

```typescript
// Green environment (new version)
await greenExecutor.up(202501290500);

// Verify green is healthy
if (await verifyGreenEnvironment()) {
  // Switch traffic to green
  await switchTraffic('green');

  // Upgrade blue to match
  await blueExecutor.up(202501290500);
} else {
  // Rollback green to match blue
  const blueVersion = await getBlueVersion();
  await greenExecutor.downTo(blueVersion);
}
```

### Round-Trip Testing

Verify migrations are properly reversible:

```typescript
// Start from clean state
await executor.down(0);

// Apply migrations
const upResult = await executor.up(202501220300);
console.log(`Applied ${upResult.executed.length} migrations`);

// Verify database state
const stateAfterUp = await captureDatabaseState();
expect(stateAfterUp).toMatchSnapshot();

// Roll back
const downResult = await executor.down(0);
console.log(`Rolled back ${downResult.executed.length} migrations`);

// Verify clean state
const stateAfterDown = await captureDatabaseState();
expect(stateAfterDown).toEqual(initialState);
```

---

## Complete Rollback

To roll back all migrations and return to an empty database, use version 0:

```typescript
// Rollback everything
const result = await executor.down(0);

if (result.success) {
  console.log('✅ All migrations rolled back');
  console.log('Database returned to initial state');
  console.log(`Rolled back ${result.executed.length} migrations`);
}
```

{: .note }
> Rolling back to version 0 removes all migration history from the schema_version table but does NOT drop the table itself.

This is useful for:
- Development: resetting to a clean slate
- Testing: ensuring tests start from a known state
- Disaster recovery: reverting to empty database before restoring from backup

---

## Version Control with Rollback Strategies

Version control methods work seamlessly with MSR's rollback strategies:

### With BACKUP Strategy

```typescript
config.rollbackStrategy = RollbackStrategy.BACKUP;

// up() creates backup before execution
const result = await executor.up(202501220300);

// If any migration fails, database is restored from backup
// Executed migrations are rolled back automatically
```

### With DOWN Strategy

```typescript
config.rollbackStrategy = RollbackStrategy.DOWN;

// up() does not create backup
const result = await executor.up(202501220300);

// If any migration fails, down() methods are called in reverse
// No backup file is created or restored
```

### With BOTH Strategy

```typescript
config.rollbackStrategy = RollbackStrategy.BOTH;

// up() creates backup before execution
const result = await executor.up(202501220300);

// If migration fails:
// 1. First tries down() methods in reverse
// 2. Falls back to backup restore if down() fails
```

{: .note }
> The `down()` method bypasses rollback strategies entirely - it always uses the DOWN approach, calling `down()` methods directly and removing records from schema_version table.

---

## Immediate Save Pattern

Both `up()` and `down()` save migration state immediately after each operation:

**up():**
- Saves to schema_version table **immediately after** each successful `up()` execution
- Ensures schema_version stays synchronized even if later migrations fail

**down():**
- Removes from schema_version table **immediately after** each successful `down()` execution
- Ensures schema_version reflects actual database state during rollback

This immediate save pattern prevents inconsistencies where the migration tracking table doesn't match the actual database state.

---

## Error Handling

### Migration Failures During up()

If a migration fails during `up()`, the behavior depends on the rollback strategy:

```typescript
const result = await executor.up(202501220300);

if (!result.success) {
  console.error('Migration failed:', result.errors);

  // Check which migrations were executed before failure
  console.log(`Executed ${result.executed.length} migrations before failure`);

  // Rollback already happened according to strategy
  // Database is in a consistent state
}
```

### Migration Failures During down()

If a migration's `down()` method fails during `down()`, the rollback stops:

```typescript
try {
  const result = await executor.down(202501220100);
} catch (error) {
  console.error('Rollback failed:', error);

  // Database may be in inconsistent state
  // Some migrations rolled back, others not
  // Manual intervention may be required
}
```

{: .warning }
> If `down()` fails partway through, the database may be in an inconsistent state. Some migrations will be rolled back (and removed from schema_version), while others remain. Manual intervention may be required to resolve the state.

---

## Best Practices

### 1. Always Implement down() Methods

If you plan to use `down()`, implement `down()` methods for all migrations:

```typescript
export default class MyMigration implements IRunnableScript {
  async up(db: IDB, info: IMigrationInfo): Promise<string> {
    // Forward migration
    return 'Migration completed';
  }

  async down(db: IDB, info: IMigrationInfo): Promise<string> {
    // Reverse migration
    return 'Rollback completed';
  }
}
```

### 2. Make down() Methods Idempotent

down() methods should be safe to run multiple times:

```typescript
async down(db: IDB, info: IMigrationInfo): Promise<string> {
  // Use IF EXISTS to avoid errors on repeat runs
  await db.query('DROP TABLE IF EXISTS users');
  await db.query('DROP INDEX IF EXISTS idx_users_email');
  return 'Rollback completed';
}
```

### 3. Test Round-Trip Migrations

Verify migrations can be applied and rolled back:

```typescript
// Automated test
describe('Migration V202501220100', () => {
  it('should apply and rollback correctly', async () => {
    // Apply
    await executor.up(202501220100);
    expect(await tableExists('users')).toBe(true);

    // Rollback
    await executor.down(0);
    expect(await tableExists('users')).toBe(false);
  });
});
```

### 4. Use Version Numbers from CI/CD

Integrate version control with your deployment pipeline:

```typescript
// Read target version from environment or config
const targetVersion = parseInt(process.env.TARGET_VERSION || '0');

if (targetVersion > 0) {
  const result = await executor.up(targetVersion);
  process.exit(result.success ? 0 : 1);
} else {
  // No target specified - run all pending migrations
  const result = await executor.migrate();
  process.exit(result.success ? 0 : 1);
}
```

### 5. Monitor Migration State

Track which version each environment is at:

```typescript
// Get current database version
const migrated = await schemaVersionService.getAllMigratedScripts();
const currentVersion = Math.max(...migrated.map(m => m.timestamp));

console.log(`Current database version: ${currentVersion}`);

// Send to metrics/monitoring
await metrics.gauge('database.version', currentVersion);
```

---

## API Reference

For complete API details, see:
- [up() API Reference](../api#migrateto)
- [down() API Reference](../api#downto)
- [MigrationScriptExecutor API Reference](../api#migrationscriptexecutor)

---

## Next Steps

- [Writing Migrations](writing-migrations) - Best practices for creating migrations
- [Migration Hooks](hooks) - Add custom logic during version control operations
- [Configuration](../configuration) - Configure rollback strategies and backup settings
