---
layout: default
title: Built-in Validation
parent: Validation
nav_order: 1
---

# Built-in Validation
{: .no_toc }

Complete guide to MSR's built-in validation rules
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Migration Script Runner performs comprehensive built-in validation on all migration scripts before execution. This validation ensures scripts follow the correct structure, implement required methods, and maintain database integrity.

Built-in validation is **automatic** and runs when `validateBeforeRun = true` (default).

---

## Validation Categories

### 1. Structural Validation

Validates the migration file structure and exports.

#### DEFAULT_EXPORT_NOT_FOUND

**Error Code:** `DEFAULT_EXPORT_NOT_FOUND`
**Type:** ERROR
**When:** Migration file doesn't export a default class

**Example Problem:**
```typescript
// ❌ Wrong - named export
export class MyMigration {
    async up() { }
}
```

**Solution:**
```typescript
// ✅ Correct - default export
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        return 'Success';
    }
}
```

---

#### INSTANTIATION_FAILED

**Error Code:** `INSTANTIATION_FAILED`
**Type:** ERROR
**When:** Cannot create an instance of the migration class

**Common Causes:**
- Constructor throws an error
- Constructor requires parameters
- Syntax errors in the class

**Example Problem:**
```typescript
// ❌ Wrong - constructor with required parameters
export default class MyMigration {
    constructor(private config: Config) {
        // MSR cannot instantiate this
    }

    async up() { }
}
```

**Solution:**
```typescript
// ✅ Correct - no-arg constructor or no constructor
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        return 'Success';
    }
}
```

---

### 2. Interface Validation

Validates method signatures match the `IRunnableScript` interface.

#### MISSING_UP_METHOD

**Error Code:** `MISSING_UP_METHOD`
**Type:** ERROR
**When:** Migration class doesn't have an `up()` method

**Example Problem:**
```typescript
// ❌ Wrong - no up() method
export default class MyMigration {
    async migrate() {
        // Wrong method name
    }
}
```

**Solution:**
```typescript
// ✅ Correct - up() method exists
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        // Implementation here
        return 'Migration completed';
    }
}
```

---

#### INVALID_UP_SIGNATURE

**Error Code:** `INVALID_UP_SIGNATURE`
**Type:** ERROR
**When:** `up()` method has incorrect parameters or return type

**Required Signature:**
```typescript
async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
): Promise<string>
```

**Example Problems:**
```typescript
// ❌ Wrong - missing parameters
export default class MyMigration {
    async up(): Promise<string> {
        return 'Success';
    }
}

// ❌ Wrong - wrong return type
export default class MyMigration {
    async up(db, info, handler): Promise<void> {
        // Should return Promise<string>
    }
}

// ❌ Wrong - not async
export default class MyMigration {
    up(db, info, handler): string {
        return 'Success';
    }
}
```

**Solution:**
```typescript
// ✅ Correct signature
export default class MyMigration {
    async up(
        db: IDB,
        info: IMigrationInfo,
        handler: IDatabaseMigrationHandler
    ): Promise<string> {
        // Your migration logic
        return 'Migration completed successfully';
    }
}
```

**Parameters:**
- `db` - Database connection/interface for executing queries
- `info` - Migration metadata (timestamp, name, etc.)
- `handler` - Database handler with schema version and backup capabilities

**Return Value:**
- Must return `Promise<string>` with a success message
- The message is stored in the schema version table

---

#### INVALID_DOWN_SIGNATURE

**Error Code:** `INVALID_DOWN_SIGNATURE`
**Type:** ERROR
**When:** `down()` method exists but has incorrect signature

**Required Signature:**
```typescript
async down(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
): Promise<string>
```

**Example Problem:**
```typescript
// ❌ Wrong - incorrect parameters
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        return 'Up';
    }

    async down(): Promise<string> {
        // Missing required parameters
        return 'Down';
    }
}
```

**Solution:**
```typescript
// ✅ Correct - same signature as up()
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        await db.execute('CREATE TABLE users (id INT)');
        return 'Table created';
    }

    async down(db, info, handler): Promise<string> {
        await db.execute('DROP TABLE users');
        return 'Table dropped';
    }
}
```

---

### 3. down() Method Validation

Validates presence of `down()` method based on configuration policy.

#### MISSING_DOWN_METHOD

**Error Code:** `MISSING_DOWN_METHOD`
**Type:** ERROR or WARNING (depends on policy)
**When:** `down()` method is missing and policy requires/recommends it

**Controlled by:** `config.downMethodPolicy`

**Policy Behavior:**

| Policy | Strategy | Severity |
|--------|----------|----------|
| `AUTO` + `DOWN` | down() required | ERROR |
| `AUTO` + `BOTH` | down() recommended | WARNING |
| `AUTO` + `BACKUP`/`NONE` | No check | - |
| `REQUIRED` | Always required | ERROR |
| `RECOMMENDED` | Always recommended | WARNING |
| `OPTIONAL` | Never checked | - |

**Example Configuration:**
```typescript
import { DownMethodPolicy, RollbackStrategy } from '@migration-script-runner/core';

// Require down() for DOWN rollback strategy
config.rollbackStrategy = RollbackStrategy.DOWN;
config.downMethodPolicy = DownMethodPolicy.AUTO;  // Will error if down() missing

// Always require down()
config.downMethodPolicy = DownMethodPolicy.REQUIRED;

// Recommend but don't enforce
config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

// Never check
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
```

**Solution:**
```typescript
// Add down() method to your migration
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        await db.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
        return 'Column added';
    }

    async down(db, info, handler): Promise<string> {
        await db.execute('ALTER TABLE users DROP COLUMN email');
        return 'Column removed';
    }
}
```

---

### 4. Integrity Validation

Validates already-executed migrations haven't been modified.

#### MIGRATED_FILE_MISSING

**Error Code:** `MIGRATED_FILE_MISSING`
**Type:** ERROR
**When:** A previously executed migration file no longer exists

**Cause:**
- Migration file was deleted
- File was moved to a different location
- File was renamed

**Example Scenario:**
```bash
# Database shows this migration was executed:
schema_version:
  timestamp: 202501220100
  name: V202501220100_create_users.ts
  executed_at: 2025-01-22 10:30:00

# But the file is missing:
migrations/
  ├── V202501220200_add_roles.ts  ✅ exists
  └── V202501220100_create_users.ts  ❌ MISSING
```

**Impact:**
- Cannot verify migration integrity
- Cannot perform rollback operations
- Deployment history is incomplete

**Solution:**
```bash
# Restore the file from version control
git checkout HEAD -- migrations/V202501220100_create_users.ts

# Or restore from backup
cp backups/V202501220100_create_users.ts migrations/
```

{: .warning }
**Never delete executed migrations!** Always keep migration files in version control, even after they've been executed in production.

---

#### MIGRATED_FILE_MODIFIED

**Error Code:** `MIGRATED_FILE_MODIFIED`
**Type:** ERROR
**When:** A previously executed migration file has been changed

**Cause:**
- File content was edited after execution
- Checksum no longer matches database record

**Example Scenario:**
```typescript
// Original migration (executed in production):
export default class CreateUsers {
    async up(db, info, handler): Promise<string> {
        await db.execute('CREATE TABLE users (id INT)');
        return 'Created';
    }
}

// Someone modified it (❌ DON'T DO THIS):
export default class CreateUsers {
    async up(db, info, handler): Promise<string> {
        await db.execute('CREATE TABLE users (id INT, name VARCHAR(255))');
        //                                           ^^^ MODIFIED
        return 'Created';
    }
}
```

**Detection:**
```
❌ MIGRATED_FILE_MODIFIED: V202501220100_create_users.ts
   Expected checksum: abc123def456
   Actual checksum:   xyz789ghi012
```

**Impact:**
- Environment divergence (dev vs prod have different migration code)
- Rollback operations may fail
- Database state inconsistency

**Solution:**
```bash
# Revert the changes
git checkout HEAD -- migrations/V202501220100_create_users.ts

# If you need to make changes, create a NEW migration
# migrations/V202501220300_add_name_to_users.ts
export default class AddNameToUsers {
    async up(db, info, handler): Promise<string> {
        await db.execute('ALTER TABLE users ADD COLUMN name VARCHAR(255)');
        return 'Column added';
    }
}
```

{: .warning }
**Never modify executed migrations!** Always create new migrations for schema changes.

---

### 5. Transaction Configuration Validation

**New in v0.5.0**

Validates transaction configuration compatibility and warns about potential issues.

#### Database Does Not Support Transactions

**Error Code:** `IMPORT_FAILED`
**Type:** ERROR
**When:** Transaction mode is enabled but database doesn't implement transaction interfaces

**Cause:**
- Database handler doesn't implement `ITransactionalDB` or `ICallbackTransactionalDB`
- Transaction mode is set to `PER_MIGRATION` or `PER_BATCH`

**Example Problem:**
```typescript
const config = new Config();
config.transaction.mode = TransactionMode.PER_MIGRATION;  // Requires ITransactionalDB

class MyDB implements IDB {
  async checkConnection(): Promise<boolean> { return true; }
  // ❌ Missing: beginTransaction(), commit(), rollback()
}
```

**Error Message:**
```
❌ Transaction configuration validation failed:

  ❌ Database does not support transactions, but transaction mode is PER_MIGRATION
     Database must implement ITransactionalDB or ICallbackTransactionalDB.
     Set transaction.mode to NONE or implement transaction methods.
```

**Solution:**
```typescript
import { ITransactionalDB } from '@migration-script-runner/core';

// Option 1: Implement ITransactionalDB
class MyDB implements ITransactionalDB {
  async checkConnection(): Promise<boolean> { return true; }

  async beginTransaction(): Promise<void> {
    await this.client.query('BEGIN');
  }

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
  }
}

// Option 2: Disable transaction mode
config.transaction.mode = TransactionMode.NONE;
```

---

#### Isolation Level Not Supported

**Error Code:** `MISSING_DOWN_WITH_BOTH_STRATEGY` (repurposed for warnings)
**Type:** WARNING
**When:** Isolation level configured but database may not support `setIsolationLevel()`

**Cause:**
- `config.transaction.isolation` is set
- Database doesn't have `setIsolationLevel()` method

**Example Scenario:**
```typescript
const config = new Config();
config.transaction.mode = TransactionMode.PER_MIGRATION;
config.transaction.isolation = IsolationLevel.SERIALIZABLE;

class MyDB implements ITransactionalDB {
  async beginTransaction(): Promise<void> { /* ... */ }
  async commit(): Promise<void> { /* ... */ }
  async rollback(): Promise<void> { /* ... */ }
  // ⚠️  Missing: setIsolationLevel(level: string): Promise<void>
}
```

**Warning Message:**
```
⚠️  Transaction configuration warnings:

  ⚠️  Isolation level SERIALIZABLE is configured, but database may not support setIsolationLevel()
      Verify your database adapter implements setIsolationLevel() method.
      Isolation level may be ignored.
```

**Solution:**
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

#### Rollback Strategy Incompatibility

**Error Code:** `MISSING_DOWN_WITH_BOTH_STRATEGY` (repurposed for warnings)
**Type:** WARNING
**When:** Using `PER_BATCH` mode with `DOWN` rollback strategy

**Cause:**
- Transaction mode is `PER_BATCH`
- Rollback strategy is `DOWN`
- Individual migration `down()` methods cannot rollback within a batch transaction

**Example Problem:**
```typescript
const config = new Config();
config.transaction.mode = TransactionMode.PER_BATCH;
config.rollbackStrategy = RollbackStrategy.DOWN;
// ⚠️  Incompatible combination
```

**Warning Message:**
```
⚠️  Transaction configuration warnings:

  ⚠️  Rollback strategy DOWN is not fully compatible with PER_BATCH transaction mode
      If a migration fails in PER_BATCH mode, the entire batch transaction will rollback.
      Individual migration down() methods cannot rollback within the batch.
      Consider using BACKUP or BOTH strategy with PER_BATCH mode.
```

**Explanation:**
```
PER_BATCH transaction:
BEGIN
  Migration 1 ✓
  Migration 2 ✓
  Migration 3 ✗ (fails)
ROLLBACK  ← Database automatically rolls back entire batch
          ← down() methods cannot execute inside rolled-back transaction
```

**Solutions:**
```typescript
// Option 1: Use BACKUP strategy with PER_BATCH
config.transaction.mode = TransactionMode.PER_BATCH;
config.rollbackStrategy = RollbackStrategy.BACKUP;

// Option 2: Use BOTH strategy (backup + down)
config.transaction.mode = TransactionMode.PER_BATCH;
config.rollbackStrategy = RollbackStrategy.BOTH;

// Option 3: Use PER_MIGRATION with DOWN
config.transaction.mode = TransactionMode.PER_MIGRATION;
config.rollbackStrategy = RollbackStrategy.DOWN;
```

---

#### Transaction Timeout Warning

**Error Code:** `MISSING_DOWN_WITH_BOTH_STRATEGY` (repurposed for warnings)
**Type:** WARNING
**When:** Many migrations in `PER_BATCH` mode with timeout configured, or very long batch without timeout

**Causes:**
- **With timeout:** > 10 migrations in `PER_BATCH` mode with `transaction.timeout` set
- **Without timeout:** > 20 migrations in `PER_BATCH` mode without timeout

**Example Scenarios:**

**Scenario 1: Timeout Risk**
```typescript
const config = new Config();
config.transaction.mode = TransactionMode.PER_BATCH;
config.transaction.timeout = 5000;  // 5 seconds

// 15 pending migrations to execute in single transaction
```

**Warning Message:**
```
⚠️  Transaction configuration warnings:

  ⚠️  15 migrations will execute in a single transaction (PER_BATCH mode)
      Transaction timeout is 5000ms. If migrations take too long, transaction may timeout.
      Consider using PER_MIGRATION mode or increasing timeout.
```

**Scenario 2: Long-Running Transaction**
```typescript
const config = new Config();
config.transaction.mode = TransactionMode.PER_BATCH;
// No timeout configured

// 25 pending migrations to execute in single transaction
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
// Option 1: Use PER_MIGRATION mode for many migrations
config.transaction.mode = TransactionMode.PER_MIGRATION;

// Option 2: Increase timeout
config.transaction.timeout = 30000;  // 30 seconds

// Option 3: Set reasonable timeout
config.transaction.timeout = 10000;  // 10 seconds

// Option 4: Run migrations in smaller batches
await executor.up(202501220500);  // First batch
await executor.up(202501220800);  // Second batch
```

---

## Validation Flow

Built-in validation runs in this order:

```
1. File Loading
   ↓
2. Structural Validation
   - DEFAULT_EXPORT_NOT_FOUND
   - INSTANTIATION_FAILED
   ↓
3. Interface Validation
   - MISSING_UP_METHOD
   - INVALID_UP_SIGNATURE
   - INVALID_DOWN_SIGNATURE
   ↓
4. down() Method Validation
   - MISSING_DOWN_METHOD (based on policy)
   ↓
5. Integrity Validation (for migrated scripts)
   - MIGRATED_FILE_MISSING
   - MIGRATED_FILE_MODIFIED
   ↓
6. Transaction Configuration Validation (v0.5.0+)
   - Database transaction support check
   - Isolation level compatibility
   - Rollback strategy compatibility
   - Transaction timeout warnings
   ↓
7. Custom Validators (if configured)
```

If any validation fails with an ERROR:
- Migration execution stops
- `ValidationError` is thrown
- No database changes occur
- No backup is created

---

## Configuration Impact

### validateBeforeRun

Controls whether built-in validation runs:

```typescript
// Validation enabled (default)
config.validateBeforeRun = true;  // ✅ Recommended

// Validation disabled
config.validateBeforeRun = false;  // ⚠️  Dangerous - only for debugging
```

When `false`:
- **No structural validation** - malformed scripts may cause runtime errors
- **No interface validation** - incorrect signatures may crash migrations
- **No integrity validation** - modified migrations won't be detected
- ⚠️  **Only disable for local debugging**

---

### strictValidation

Controls whether warnings become errors:

```typescript
// Warnings allowed (default)
config.strictValidation = false;

// Warnings block execution
config.strictValidation = true;
```

**When `true`:**
- `MISSING_DOWN_METHOD` warnings become errors (if policy is RECOMMENDED)
- Custom validator warnings block execution
- Useful for CI/CD to enforce strict quality

**Example:**
```typescript
// In CI/CD, use strict mode
if (process.env.CI === 'true') {
    config.strictValidation = true;
    config.downMethodPolicy = DownMethodPolicy.REQUIRED;
}
```

---

### downMethodPolicy

Controls `down()` method validation:

```typescript
import { DownMethodPolicy } from '@migration-script-runner/core';

// Auto-detect based on rollback strategy (default)
config.downMethodPolicy = DownMethodPolicy.AUTO;

// Always require down()
config.downMethodPolicy = DownMethodPolicy.REQUIRED;

// Always warn about missing down()
config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

// Never check for down()
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
```

**Recommendations:**

| Environment | Recommended Policy |
|-------------|-------------------|
| Production | `AUTO` or `RECOMMENDED` |
| CI/CD | `REQUIRED` + `strictValidation = true` |
| Development | `AUTO` or `RECOMMENDED` |
| Testing | `OPTIONAL` (if using backup strategy) |

---

## Error Messages

Built-in validation provides detailed error messages:

### Example: MISSING_UP_METHOD

```
❌ Validation Error: MISSING_UP_METHOD

Migration: V202501220100_create_users.ts
Issue: The migration class must implement an up() method

Expected signature:
  async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string>

Fix: Add the up() method to your migration class.
```

### Example: MIGRATED_FILE_MODIFIED

```
❌ Validation Error: MIGRATED_FILE_MODIFIED

Migration: V202501220100_create_users.ts
Executed: 2025-01-22 10:30:00

Checksum mismatch:
  Expected: abc123def456789
  Actual:   xyz987ghi654321

Impact: This migration was previously executed but the file has been modified.
        This may cause inconsistency between environments.

Fix: Revert the changes to this file. Create a new migration for schema changes.
```

---

## Testing Validation

### Test Your Migrations

Run validation without executing:

```typescript
import { MigrationScriptExecutor, ValidationError } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor(handler, config);

try {
    // This will validate but not execute if you catch the error early
    const result = await executor.migrate();
} catch (error) {
    if (error instanceof ValidationError) {
        console.log('Validation failed (as expected for testing)');
        console.log(`Errors: ${error.errorCount}`);
        console.log(`Warnings: ${error.warningCount}`);

        error.validationResults.forEach(result => {
            if (!result.valid) {
                console.log(`\n${result.script.name}:`);
                result.issues.forEach(issue => {
                    console.log(`  [${issue.code}] ${issue.message}`);
                });
            }
        });
    }
}
```

### Unit Test Validation

```typescript
import { expect } from 'chai';
import { MigrationValidationService } from '@migration-script-runner/core';

describe('Migration Validation', () => {
    it('should validate migration structure', async () => {
        const service = new MigrationValidationService();
        const result = await service.validateOne(script, config);

        expect(result.valid).to.be.true;
        expect(result.issues).to.have.lengthOf(0);
    });

    it('should detect missing up() method', async () => {
        const service = new MigrationValidationService();
        const result = await service.validateOne(badScript, config);

        expect(result.valid).to.be.false;
        expect(result.issues[0].code).to.equal('MISSING_UP_METHOD');
    });
});
```

---

## Best Practices

### 1. Always Keep Validation Enabled

```typescript
// ✅ Good - validation enabled
config.validateBeforeRun = true;

// ❌ Bad - only disable for debugging
config.validateBeforeRun = false;
```

### 2. Use Strict Mode in CI/CD

```typescript
if (process.env.CI) {
    config.strictValidation = true;
    config.downMethodPolicy = DownMethodPolicy.REQUIRED;
}
```

### 3. Never Modify Executed Migrations

```bash
# ✅ Good - create new migration
git add migrations/V202501220300_add_email_column.ts

# ❌ Bad - modifying executed migration
git add migrations/V202501220100_create_users.ts  # Already executed!
```

### 4. Keep Migration Files in Version Control

```gitignore
# ✅ Good - track migrations
migrations/**/*.ts

# ❌ Bad - don't ignore migrations
# migrations/
```

### 5. Test Migrations Before Deployment

```bash
# Run migrations in dev/staging first
npm run migrate

# Validation will catch issues before production
```

---

## Troubleshooting

### Problem: Validation passes locally but fails in CI

**Cause:** File modifications or missing files

**Solution:**
```bash
# Ensure all migrations are committed
git status migrations/

# Check for uncommitted changes
git diff migrations/
```

### Problem: INSTANTIATION_FAILED error

**Cause:** Constructor throws an error or requires parameters

**Solution:**
```typescript
// Remove constructor or make it parameter-free
export default class MyMigration {
    // No constructor, or:
    constructor() {
        // Don't throw errors here
    }
}
```

### Problem: False positive on MIGRATED_FILE_MODIFIED

**Cause:** Line ending differences (CRLF vs LF)

**Solution:**
```bash
# Normalize line endings
git config core.autocrlf input

# Re-checkout files
git checkout -- migrations/
```

---

## Reference

### All Built-in Validation Error Codes

| Code | Type | Description |
|------|------|-------------|
| `DEFAULT_EXPORT_NOT_FOUND` | ERROR | Missing default export |
| `INSTANTIATION_FAILED` | ERROR | Cannot create class instance |
| `MISSING_UP_METHOD` | ERROR | No up() method |
| `INVALID_UP_SIGNATURE` | ERROR | Wrong up() signature |
| `INVALID_DOWN_SIGNATURE` | ERROR | Wrong down() signature |
| `MISSING_DOWN_METHOD` | ERROR/WARNING | No down() method (policy-based) |
| `MIGRATED_FILE_MISSING` | ERROR | Executed migration file deleted |
| `MIGRATED_FILE_MODIFIED` | ERROR | Executed migration file changed |
| `IMPORT_FAILED` | ERROR | Database doesn't support transactions (v0.5.0+) |
| `MISSING_DOWN_WITH_BOTH_STRATEGY` | WARNING | Transaction configuration warnings (v0.5.0+) |
